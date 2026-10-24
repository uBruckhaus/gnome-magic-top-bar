gjs -m "$ROOT/tests/tray-app/reorderTool.js" >"$T/tray-app.log" 2>&1 &
TRAY_PID=$!
sleep 16
echo "--- disable / enable (like locking and unlocking)"
gnome-extensions disable $UUID; sleep 2; gnome-extensions enable $UUID; sleep 5
kill $TRAY_PID 2>/dev/null
echo "tray app: $(grep -c . "$T/tray-app.log") lines; $(grep -m1 -i 'clicked\|error' "$T/tray-app.log")"
