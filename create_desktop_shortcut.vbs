Set WshShell = CreateObject("WScript.Shell")
strDesktop = WshShell.SpecialFolders("Desktop")
Set oShortcut = WshShell.CreateShortcut(strDesktop & "\Happy Bonding ERP.lnk")
oShortcut.TargetPath = "d:\Project\Happy Bonding BillBook\Happy Bonding ERP.bat"
oShortcut.WorkingDirectory = "d:\Project\Happy Bonding BillBook"
oShortcut.IconLocation = "%SystemRoot%\System32\shell32.dll, 44"
oShortcut.Save
