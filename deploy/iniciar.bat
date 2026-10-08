@echo off
rem Treinador de Carisma - Edicao Local (Windows)
rem Uso: deploy\iniciar.bat   (porta 8787; para outra: set TC_PORTA=8790)
setlocal
chcp 65001 >nul

set "RAIZ=%~dp0.."
set "GW=%RAIZ%\gateway"
set "VENV=%GW%\.venv"
if "%TC_HOST%"=="" set "TC_HOST=127.0.0.1"
if "%TC_PORTA%"=="" set "TC_PORTA=8787"
if "%OLLAMA_URL%"=="" set "OLLAMA_URL=http://127.0.0.1:11434"

where python >nul 2>&1 || (
  echo ERRO: Python 3 nao encontrado. Instale em https://www.python.org/downloads/ marcando "Add to PATH".
  exit /b 1
)

if not exist "%VENV%\Scripts\python.exe" (
  echo ^> Criando ambiente virtual em gateway\.venv ...
  python -m venv "%VENV%" || exit /b 1
)
echo ^> Instalando dependencias ...
"%VENV%\Scripts\python.exe" -m pip install -q -r "%GW%\requirements.txt" || exit /b 1
rem Voz local (opcional): set TC_INSTALAR_VOZ=1 instala faster-whisper, piper-tts e kokoro
if "%TC_INSTALAR_VOZ%"=="1" "%VENV%\Scripts\python.exe" -m pip install -q faster-whisper piper-tts kokoro
if "%TC_AQUECER%"=="" set "TC_AQUECER=1"

echo ^> Verificando motores ...
"%VENV%\Scripts\python.exe" -c "import urllib.request,os;urllib.request.urlopen(os.environ['OLLAMA_URL']+'/api/tags',timeout=2)" >nul 2>&1 && (echo   ollama: ok) || (echo   ollama: NAO encontrado - instale em https://ollama.com e rode: ollama pull llama3.2)
where codex >nul 2>&1 && (echo   codex: instalado ^(confira "codex login status"^)) || (echo   codex: nao instalado ^(opcional^))
if not exist "%RAIZ%\treinar" echo   aviso: pasta treinar\ ausente - rode o build do app

netstat -ano | findstr /R /C:":%TC_PORTA% .*LISTENING" >nul && (
  echo ERRO: a porta %TC_PORTA% ja esta em uso. Use: set TC_PORTA=8790
  exit /b 1
)

echo.
echo Treinador de Carisma no ar: http://127.0.0.1:%TC_PORTA%/   (Ctrl+C para parar)
echo.
"%VENV%\Scripts\python.exe" -m uvicorn app:app --app-dir "%GW%" --host %TC_HOST% --port %TC_PORTA%
endlocal
