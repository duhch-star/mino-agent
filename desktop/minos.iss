#ifndef StageDir
  #define StageDir "..\dist\windows\app"
#endif
#ifndef OutputDir
  #define OutputDir "..\dist\windows"
#endif
[Setup]
AppId={{FA6C6938-7FB9-4706-9271-508976B5A6D0}
AppName=MINOS
AppVersion=1.0.0
AppPublisher=MINOS
DefaultDirName={localappdata}\Programs\MINOS
DefaultGroupName=MINOS
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
OutputDir={#OutputDir}
OutputBaseFilename=MINOS-Electron-Inno-Setup-1.0.0-x64
SetupIconFile=..\pi-web\app\favicon.ico
UninstallDisplayIcon={app}\MINOS.exe
Compression=lzma2/fast
SolidCompression=yes
WizardStyle=modern
CloseApplications=yes
[Files]
Source: "{#StageDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
[Tasks]
Name: desktopicon; Description: "Create a desktop shortcut"; Flags: checkedonce
[Icons]
Name: "{group}\MINOS"; Filename: "{app}\MINOS.exe"
Name: "{autodesktop}\MINOS"; Filename: "{app}\MINOS.exe"; Tasks: desktopicon
[Run]
Filename: "{app}\MINOS.exe"; Description: "Launch MINOS"; Flags: nowait postinstall skipifsilent
