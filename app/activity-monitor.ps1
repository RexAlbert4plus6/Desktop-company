$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class KairosActivity {
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
 [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int key);
 public static bool UndoDown() { return (GetAsyncKeyState(0x11)&0x8000)!=0 && (GetAsyncKeyState(0x5A)&0x8000)!=0 && (GetAsyncKeyState(0x10)&0x8000)==0 && (GetAsyncKeyState(0x12)&0x8000)==0; }
}
'@ | Out-Null
$lastWindow=[IntPtr]::Zero
$appName=''
$lastUndo=$false
$detectUndo=KAIROS_UNDO_ENABLED
$lastSent=[DateTime]::UtcNow.AddSeconds(-2)
$drawPattern='^(photoshop|illustrator|aseprite|krita|clipstudiopaint|sai2?|paintdotnet|mspaint|firealpaca|medibangpaint|blender)$'
while($true){
 # Parent PID is supplied as a numeric literal by the application, never by user text.
 try {$parent=[Diagnostics.Process]::GetProcessById(KAIROS_PARENT_PID);if($parent.HasExited){break}}catch{break}
 $window=[KairosActivity]::GetForegroundWindow()
 $changed=$window -ne $lastWindow
 if($changed){
  $appName='';$lastUndo=$false;$lastWindow=$window
  if($window -ne [IntPtr]::Zero){[uint32]$foregroundId=0;[void][KairosActivity]::GetWindowThreadProcessId($window,[ref]$foregroundId);try{$appName=[Diagnostics.Process]::GetProcessById($foregroundId).ProcessName.ToLowerInvariant()}catch{}}
 }
 $own=$appName -in @('kairosdesktop','electron')
 # Only Ctrl+Z state in known creative applications is sampled. No text or other keys are recorded.
 $undoDown=$detectUndo -and ($appName -match $drawPattern) -and [KairosActivity]::UndoDown()
 $undo=$undoDown -and -not $lastUndo;$lastUndo=$undoDown
 if($changed -or $undo -or ([DateTime]::UtcNow-$lastSent).TotalSeconds -ge 1){
  [Console]::WriteLine((@{app=$appName;own=$own;undo=$undo;valid=($window -ne [IntPtr]::Zero)} | ConvertTo-Json -Compress))
  $lastSent=[DateTime]::UtcNow
 }
 Start-Sleep -Milliseconds 50
}
