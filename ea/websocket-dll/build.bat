@echo off
REM WebSocket DLL Build Script for Windows
REM Usage: build.bat [x86|x64]

setlocal enabledelayedexpansion

echo === WebSocket DLL Build for Windows ===

REM Determine architecture
set ARCH=%1
if "%ARCH%"=="" set ARCH=x64

echo Building for architecture: %ARCH%

REM Visual Studio環境の検出
set VS_PATH=
set CMAKE_GENERATOR=

REM VS2022のチェック
if exist "%ProgramFiles%\Microsoft Visual Studio\2022\Enterprise\VC\Auxiliary\Build\vcvars64.bat" (
    set VS_PATH=%ProgramFiles%\Microsoft Visual Studio\2022\Enterprise\VC\Auxiliary\Build
    set CMAKE_GENERATOR="Visual Studio 17 2022"
    echo Found Visual Studio 2022 Enterprise
) else if exist "%ProgramFiles%\Microsoft Visual Studio\2022\Professional\VC\Auxiliary\Build\vcvars64.bat" (
    set VS_PATH=%ProgramFiles%\Microsoft Visual Studio\2022\Professional\VC\Auxiliary\Build
    set CMAKE_GENERATOR="Visual Studio 17 2022"
    echo Found Visual Studio 2022 Professional
) else if exist "%ProgramFiles%\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat" (
    set VS_PATH=%ProgramFiles%\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build
    set CMAKE_GENERATOR="Visual Studio 17 2022"
    echo Found Visual Studio 2022 Community
)

REM VS2019のチェック（VS2022が見つからない場合）
if "%VS_PATH%"=="" (
    if exist "%ProgramFiles(x86)%\Microsoft Visual Studio\2019\Enterprise\VC\Auxiliary\Build\vcvars64.bat" (
        set VS_PATH=%ProgramFiles(x86)%\Microsoft Visual Studio\2019\Enterprise\VC\Auxiliary\Build
        set CMAKE_GENERATOR="Visual Studio 16 2019"
        echo Found Visual Studio 2019 Enterprise
    ) else if exist "%ProgramFiles(x86)%\Microsoft Visual Studio\2019\Professional\VC\Auxiliary\Build\vcvars64.bat" (
        set VS_PATH=%ProgramFiles(x86)%\Microsoft Visual Studio\2019\Professional\VC\Auxiliary\Build
        set CMAKE_GENERATOR="Visual Studio 16 2019"
        echo Found Visual Studio 2019 Professional
    ) else if exist "%ProgramFiles(x86)%\Microsoft Visual Studio\2019\Community\VC\Auxiliary\Build\vcvars64.bat" (
        set VS_PATH=%ProgramFiles(x86)%\Microsoft Visual Studio\2019\Community\VC\Auxiliary\Build
        set CMAKE_GENERATOR="Visual Studio 16 2019"
        echo Found Visual Studio 2019 Community
    )
)

if "%VS_PATH%"=="" (
    echo ERROR: Visual Studio 2019 or 2022 not found!
    echo Please install Visual Studio with C++ development tools.
    exit /b 1
)

REM Visual Studio環境の初期化
if "%ARCH%"=="x86" (
    call "%VS_PATH%\vcvars32.bat"
) else (
    call "%VS_PATH%\vcvars64.bat"
)

REM CMakeの確認
where cmake >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: CMake not found!
    echo Please install CMake from https://cmake.org/download/
    exit /b 1
)

REM OpenSSLのパス設定（必要に応じて調整）
set OPENSSL_ROOT_DIR=C:\Program Files\OpenSSL-Win64
if not exist "%OPENSSL_ROOT_DIR%" (
    set OPENSSL_ROOT_DIR=C:\OpenSSL-Win64
)
if not exist "%OPENSSL_ROOT_DIR%" (
    echo WARNING: OpenSSL not found at default locations
    echo Please install OpenSSL or set OPENSSL_ROOT_DIR
)

REM ビルドディレクトリの作成
set BUILD_DIR=build\%ARCH%
if exist %BUILD_DIR% (
    echo Cleaning previous build...
    rmdir /s /q %BUILD_DIR%
)
mkdir %BUILD_DIR%
cd %BUILD_DIR%

REM CMakeの実行
echo.
echo Running CMake...

if "%ARCH%"=="x86" (
    cmake ..\.. -G %CMAKE_GENERATOR% -A Win32 ^
        -DCMAKE_BUILD_TYPE=Release ^
        -DOPENSSL_ROOT_DIR="%OPENSSL_ROOT_DIR%"
) else (
    cmake ..\.. -G %CMAKE_GENERATOR% -A x64 ^
        -DCMAKE_BUILD_TYPE=Release ^
        -DOPENSSL_ROOT_DIR="%OPENSSL_ROOT_DIR%"
)

if %ERRORLEVEL% NEQ 0 (
    echo ERROR: CMake configuration failed!
    cd ..\..
    exit /b 1
)

REM ビルドの実行
echo.
echo Building DLL...
cmake --build . --config Release

if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Build failed!
    cd ..\..
    exit /b 1
)

REM 成果物の確認
echo.
echo === Build Complete ===
echo Output files:
dir /b Release\*.dll 2>nul
dir /b Release\*.lib 2>nul

REM MT5用のディレクトリにコピー（オプション）
set MT5_DIR=..\..\mt5_libs\%ARCH%
if not exist %MT5_DIR% mkdir %MT5_DIR%
copy /y Release\*.dll %MT5_DIR%\ >nul 2>&1
copy /y Release\*.lib %MT5_DIR%\ >nul 2>&1

echo.
echo DLL location: %CD%\Release\HedgeSystemWebSocket.dll
if exist %MT5_DIR%\HedgeSystemWebSocket.dll (
    echo Copied to MT5 directory: %MT5_DIR%\HedgeSystemWebSocket.dll
)

cd ..\..

echo.
echo Build completed successfully!
echo.
echo To use in MT5:
echo 1. Copy HedgeSystemWebSocket.dll to your MT5 Terminal\Libraries folder
echo 2. Restart MT5 Terminal
echo 3. Load HedgeSystemConnector.mq5

endlocal