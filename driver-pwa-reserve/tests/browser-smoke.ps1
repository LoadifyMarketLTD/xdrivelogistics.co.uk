$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
& $edge --headless --disable-gpu --no-first-run --no-default-browser-check --virtual-time-budget=4000 --dump-dom 'http://127.0.0.1:4277/' 2>$null | Select-String 'XDRIVE|BACKEND NOT CONNECTED|Loads' | Select-Object -First 3
