; 동글 변환기 도우미 (AutoHotkey v2)
; 탐색기·바탕화면에서 Alt+우클릭 또는 Ctrl+Shift+D 를 누르면
; 선택된 파일 경로를 본체(Electron)에게 한 줄로 알려준다:  RING<탭>경로1<탭>경로2...
#Requires AutoHotkey v2.0
#SingleInstance Force
#NoTrayIcon
Persistent
CoordMode "Mouse", "Screen"

IsShellClass(cls) {
    return (cls = "CabinetWClass" || cls = "ExploreWClass" || cls = "Progman" || cls = "WorkerW")
}

OverShell() {
    try {
        MouseGetPos , , &win
        return IsShellClass(WinGetClass("ahk_id " win))
    } catch {
        return false
    }
}

ActiveShell() {
    try {
        return IsShellClass(WinGetClass("A"))
    } catch {
        return false
    }
}

; 선택된 파일을 잠깐 복사해서 경로를 읽고, 클립보드는 원래대로 되돌린다
GrabSelection() {
    saved := ClipboardAll()
    A_Clipboard := ""
    Send "^c"
    text := ClipWait(0.6) ? A_Clipboard : ""
    A_Clipboard := saved
    saved := ""
    paths := []
    for line in StrSplit(text, "`n", "`r") {
        if (line = "")
            continue
        attr := FileExist(line)
        if (attr != "" && !InStr(attr, "D"))
            paths.Push(line)
    }
    return paths
}

Emit(paths) {
    if (paths.Length = 0)
        return
    out := "RING"
    for p in paths
        out .= "`t" p
    try FileAppend(out "`n", "*", "UTF-8-RAW")
}

#HotIf OverShell()
!RButton:: {
    Click            ; 마우스 아래 파일을 먼저 선택
    Sleep 90
    Emit(GrabSelection())
}

#HotIf ActiveShell()
^+d:: Emit(GrabSelection())
#HotIf
