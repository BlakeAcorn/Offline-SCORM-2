@echo off
REM Offline SCORM Player - Installation Script for Windows
REM This script will set up the project for first-time use

echo ================================================
echo   Offline SCORM Player - Setup
echo ================================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js 16 or higher from https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js detected: 
node -v
echo.

REM Install dependencies
echo Installing dependencies...
call npm install

if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo Dependencies installed successfully
echo.

REM Create storage directories
echo Creating storage directories...
if not exist "storage\packages" mkdir "storage\packages"
if not exist "storage\uploads" mkdir "storage\uploads"
if not exist "storage\db" mkdir "storage\db"

echo Storage directories created
echo.

REM Create .env file if it doesn't exist
if not exist ".env" (
    echo Creating .env file...
    copy ".env.example" ".env"
    echo .env file created (you can customize it later)
) else (
    echo .env file already exists, skipping...
)

echo.
echo ================================================
echo   Setup Complete!
echo ================================================
echo.
echo Next steps:
echo.
echo   1. Start the server:
echo      npm run dev (development with auto-reload^)
echo      npm start (production^)
echo.
echo   2. Open your browser to:
echo      http://localhost:3000
echo.
echo   3. Upload a SCORM package using Postman or similar
echo.
echo   4. Read the documentation:
echo      - QUICKSTART.md for quick start guide
echo      - INTEGRATION.md for integration details
echo      - PROJECT_SUMMARY.md for complete overview
echo.
echo ================================================
echo   Happy Learning!
echo ================================================
echo.
pause
