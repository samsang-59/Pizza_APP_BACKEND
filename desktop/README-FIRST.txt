SkyTrace AI - desktop app (prototype)
=====================================

Every coordinate matters.
Prototype for demonstration. NOT for operational search-and-rescue decisions.

HOW TO RUN
----------
Windows:  double-click SkyTraceAI.exe
          If Windows SmartScreen warns about an unrecognised app, click
          "More info" -> "Run anyway" (the app is not code-signed).

macOS:    double-click SkyTraceAI (it opens in Terminal).
          The first time, macOS may block it because it is not signed:
          right-click the file -> Open -> Open. Or, in Terminal:
            xattr -dr com.apple.quarantine SkyTraceAI && ./SkyTraceAI

Linux:    chmod +x SkyTraceAI && ./SkyTraceAI

Your web browser opens SkyTrace AI automatically (usually http://127.0.0.1:8000).
If it does not, copy the address shown in the console window into your browser.
Keep the console window open while you use the app; close it to quit.

The first start can take 10-20 seconds while the app unpacks itself.
Everything runs locally on your computer. An internet connection is only needed
for the OpenStreetMap background tiles on the map.

Then: click LOAD DEMO SCENARIO, then ANALYZE SEARCH AREA.
