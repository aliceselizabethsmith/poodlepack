# Play an audio file through .NET MediaPlayer (Media Foundation). Unlike ffplay/SDL,
# this follows the Windows *default* output device — including virtual devices such as
# SoundWire — so in-app music is audible wherever the user actually listens, and it
# needs no ffmpeg. Used by viz/audio.js on Windows.
#
# Stops when the parent process tells it to (a tree-kill), or self-exits if that parent
# dies unexpectedly (a hard crash) so music never outlives the window it belongs to.
param(
  [Parameter(Mandatory = $true)][string]$Path,
  [double]$Volume = 0.4,
  [switch]$Loop,
  [int]$ParentPid = 0
)
Add-Type -AssemblyName PresentationCore, WindowsBase
$player = New-Object System.Windows.Media.MediaPlayer
if ($Loop) {
  $player.add_MediaEnded({ $player.Position = [TimeSpan]::Zero; $player.Play() })
} else {
  $player.add_MediaEnded({ [System.Windows.Threading.Dispatcher]::ExitAllFrames() })
}
$player.add_MediaFailed({ [System.Windows.Threading.Dispatcher]::ExitAllFrames() })

# Watchdog: a child job blocks on Wait-Process for the parent window, then kills this
# helper — so a hard crash (where the app never runs its own stop logic) can't leave music
# playing. The job is a child of this process, so a normal tree-kill stop reaps it too.
# (A DispatcherTimer is unreliable here — its Tick doesn't fire under Dispatcher::Run.)
if ($ParentPid -gt 0) {
  Start-Job -ScriptBlock {
    param($parent, $self)
    Wait-Process -Id $parent -ErrorAction SilentlyContinue
    Stop-Process -Id $self -Force -ErrorAction SilentlyContinue
  } -ArgumentList $ParentPid, $PID | Out-Null
}

$player.Open([System.Uri]$Path)
$player.Volume = $Volume
$player.Play()
[System.Windows.Threading.Dispatcher]::Run()
