# Play an audio file through .NET MediaPlayer (Media Foundation). Unlike ffplay/SDL,
# this follows the Windows *default* output device — including virtual devices such as
# SoundWire — so in-app music is audible wherever the user actually listens, and it
# needs no ffmpeg. Used by viz/audio.js on Windows; the parent process kills this to stop.
param(
  [Parameter(Mandatory = $true)][string]$Path,
  [double]$Volume = 0.4,
  [switch]$Loop
)
Add-Type -AssemblyName PresentationCore, WindowsBase
$player = New-Object System.Windows.Media.MediaPlayer
if ($Loop) {
  $player.add_MediaEnded({ $player.Position = [TimeSpan]::Zero; $player.Play() })
} else {
  $player.add_MediaEnded({ [System.Windows.Threading.Dispatcher]::ExitAllFrames() })
}
$player.add_MediaFailed({ [System.Windows.Threading.Dispatcher]::ExitAllFrames() })
$player.Open([System.Uri]$Path)
$player.Volume = $Volume
$player.Play()
[System.Windows.Threading.Dispatcher]::Run()
