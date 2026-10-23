@echo off
set "JAVA_HOME=%USERPROFILE%\.jdks\jbr-21.0.11"
set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%"
echo Using JAVA_HOME: %JAVA_HOME%
echo Building Release APK...
call gradlew.bat assembleRelease
echo Done! APK located at: app\build\outputs\apk\release\app-release.apk
