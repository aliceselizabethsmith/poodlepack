# Kill any ORPHANED play-audio.ps1 music helper — one whose parent window process is gone
# (e.g. left behind if a hard crash beat the in-helper watchdog). Safe to run anytime,
# including at startup: it never touches a helper whose window is still alive, so it can't
# silence another open PoodlePack window.
Get-CimInstance Win32_Process -Filter "name='powershell.exe'" |
  Where-Object { $_.CommandLine -and $_.CommandLine -like '*play-audio.ps1*' } |
  ForEach-Object {
    if ($_.CommandLine -match '-ParentPid\s+(\d+)') {
      $parent = [int]$Matches[1]
      if (-not (Get-Process -Id $parent -ErrorAction SilentlyContinue)) {
        try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {}
      }
    }
  }
