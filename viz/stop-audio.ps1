# Stop every play-audio.ps1 music helper (the -STA host can spawn a child, and a hard
# window-kill can orphan one) so audio never outlives a PoodlePack window. Matches by
# script name in the command line, so it gets the host and any child it relaunched.
Get-CimInstance Win32_Process -Filter "name='powershell.exe'" |
  Where-Object { $_.CommandLine -and $_.CommandLine -like '*play-audio.ps1*' } |
  ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {} }
