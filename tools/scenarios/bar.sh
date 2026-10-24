gnome-text-editor >/dev/null 2>&1 &
sleep 3
sleep 17
echo "--- disable / enable (like locking and unlocking)"
gnome-extensions disable $UUID; sleep 1; gnome-extensions enable $UUID; sleep 2
gnome-extensions info $UUID | grep State
