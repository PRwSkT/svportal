#!/bin/bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
DEST="/Users/peerawatsmacbookpro/.gemini/antigravity/brain/cbe7573a-d189-40c0-bcdf-af6f64423ec9"

echo "📸 Capturing SV Portal Screens..."

# 1. Welcome Landing Page
"$CHROME" --headless --disable-gpu --virtual-time-budget=2000 --window-size=1280,850 --screenshot="$DEST/portal_welcome.png" "http://localhost:3000/"

# 2. Login Page
"$CHROME" --headless --disable-gpu --virtual-time-budget=2000 --window-size=1280,850 --screenshot="$DEST/portal_login.png" "http://localhost:3000/login"

# 3. Home Launchpad
"$CHROME" --headless --disable-gpu --virtual-time-budget=3000 --window-size=1280,1050 --screenshot="$DEST/portal_home.png" "http://localhost:3000/home"

# 4. Operational Work Calendar
"$CHROME" --headless --disable-gpu --virtual-time-budget=3000 --window-size=1280,1000 --screenshot="$DEST/portal_calendar.png" "http://localhost:3000/calendar"

# 5. Academic Hub
"$CHROME" --headless --disable-gpu --virtual-time-budget=3000 --window-size=1280,1000 --screenshot="$DEST/portal_academic.png" "http://localhost:3000/academic"

# 6. Smart Gradebook (ปพ.5)
"$CHROME" --headless --disable-gpu --virtual-time-budget=3000 --window-size=1280,1000 --screenshot="$DEST/portal_gradebook.png" "http://localhost:3000/academic/gradebook"

# 7. Timetable & Substitutions
"$CHROME" --headless --disable-gpu --virtual-time-budget=3000 --window-size=1280,1000 --screenshot="$DEST/portal_timetable.png" "http://localhost:3000/academic/timetable"

# 8. Early Years Assessment (ปฐมวัย)
"$CHROME" --headless --disable-gpu --virtual-time-budget=3000 --window-size=1280,1000 --screenshot="$DEST/portal_early_years.png" "http://localhost:3000/academic/early-years"

# 9. Smart Exams & OMR Paper Grading
"$CHROME" --headless --disable-gpu --virtual-time-budget=3000 --window-size=1280,1000 --screenshot="$DEST/portal_exams.png" "http://localhost:3000/academic/exams"

echo "✅ All portal screenshots captured successfully!"
