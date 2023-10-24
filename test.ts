serial.setBaudRate(BaudRate.BaudRate115200)
Brickcell.iaqInit()
basic.forever(function () {
    serial.writeString("tvoc: " + Brickcell.tvoc())
    serial.writeLine(" | co2eq: " + Brickcell.co2eq())
    basic.pause(2000)
})
