 = [System.Diagnostics.Stopwatch]::StartNew()
 = New-Object -ComObject WScript.Network
.SetDefaultPrinter('Microsoft Print to PDF')
.Stop()
Write-Host "WScript.Network took: ms"

.Restart()
 = Get-CimInstance -ClassName Win32_Printer -Filter "Name = 'Microsoft Print to PDF'"
Invoke-CimMethod -InputObject  -MethodName SetDefaultPrinter | Out-Null
.Stop()
Write-Host "Invoke-CimMethod took: ms"
