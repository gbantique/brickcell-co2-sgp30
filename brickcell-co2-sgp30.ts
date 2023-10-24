// Ported from: https://github.com/fantasticdonkey/uSGP30/

// General SGP30 settings
const SGP30_DEFAULT_I2C_ADDR: number = 0x58;
const SGP30_WORD_LEN: number = 2;
const SGP30_CRC8_POLYNOMIAL: number = 0x31;
const SGP30_CRC8_INIT: number = 0xFF;
const SGP30_CRC8_FINAL_XOR: number = 0xFF;
const SGP30_MEASURE_TEST_PASS: number = 0xD400;

// SGP30 feature set measurement commands (Hex Codes)
// From datasheet section 6.3
const SGP30_CMD_IAQ_INIT_HEX: number[] = [0x20, 0x03];
const SGP30_CMD_IAQ_INIT_WORDS: number = 0;
const SGP30_CMD_IAQ_INIT_MAX_MS: number = 10;
const SGP30_CMD_MEASURE_IAQ_HEX: number[] = [0x20, 0x08];
const SGP30_CMD_MEASURE_IAQ_WORDS: number = 2;
const SGP30_CMD_MEASURE_IAQ_MS: number = 12;
const SGP30_CMD_GET_IAQ_BASELINE_HEX: number[] = [0x20, 0x15];
const SGP30_CMD_GET_IAQ_BASELINE_WORDS: number = 2;
const SGP30_CMD_GET_IAQ_BASELINE_MAX_MS: number = 10;
const SGP30_CMD_SET_IAQ_BASELINE_HEX: number[] = [0x20, 0x1E];
const SGP30_CMD_SET_IAQ_BASELINE_WORDS: number = 0;
const SGP30_CMD_SET_IAQ_BASELINE_MAX_MS: number = 10;
const SGP30_CMD_SET_ABSOLUTE_HUMIDITY_HEX: number[] = [0x20, 0x61];
const SGP30_CMD_SET_ABSOLUTE_HUMIDITY_WORDS: number = 0;
const SGP30_CMD_SET_ABSOLUTE_HUMIDITY_MAX_MS: number = 10;
const SGP30_CMD_MEASURE_TEST_HEX: number[] = [0x20, 0x32];
const SGP30_CMD_MEASURE_TEST_WORDS: number = 1;
const SGP30_CMD_MEASURE_TEST_MAX_MS: number = 220;
const SGP30_CMD_GET_FEATURE_SET_HEX: number[] = [0x20, 0x2F];
const SGP30_CMD_GET_FEATURE_SET_WORDS: number = 1;
const SGP30_CMD_GET_FEATURE_SET_MAX_MS: number = 10;
const SGP30_CMD_MEASURE_RAW_HEX: number[] = [0x20, 0x50];
const SGP30_CMD_MEASURE_RAW_WORDS: number = 2;
const SGP30_CMD_MEASURE_RAW_MAX_MS: number = 25;
const SGP30_CMD_GET_TVOC_INCEPTIVE_HEX: number[] = [0x20, 0xB3];
const SGP30_CMD_GET_TVOC_INCEPTIVE_WORDS: number = 1;
const SGP30_CMD_GET_TVOC_INCEPTIVE_MAX_MS: number = 10;
const SGP30_CMD_SET_TVOC_BASELINE_HEX: number[] = [0x20, 0x77];
const SGP30_CMD_SET_TVOC_BASELINE_WORDS: number = 0;
const SGP30_CMD_SET_TVOC_BASELINE_MAX_MS: number = 10;

// TODO: Soft Reset (datasheet section 6.4)

// Obtaining Serial ID (datasheet section 6.5)
const SGP30_CMD_GET_SERIAL_ID_HEX: number[] = [0x36, 0x82];
const SGP30_CMD_GET_SERIAL_ID_WORDS: number = 3;
const SGP30_CMD_GET_SERIAL_ID_MAX_MS: number = 10;

//% color="#FFBF00" icon="\uf12e" weight=70
namespace Brickcell {

    function getRegister(register: number): number {
        let data = pins.createBuffer(1)
        data[0] = register
        pins.i2cWriteBuffer(SGP30_DEFAULT_I2C_ADDR, data)
        return pins.i2cReadNumber(SGP30_DEFAULT_I2C_ADDR, NumberFormat.UInt8LE)
    }

    function setRegister(register: number, value: number) {
        let data = pins.createBuffer(2)
        data[0] = register
        data[1] = value
        pins.i2cWriteBuffer(SGP30_DEFAULT_I2C_ADDR, data)
    }

    function numberArrayToBuffer(arr: number[]): Buffer {
        let buf = pins.createBuffer(arr.length);
        for (let i = 0; i < arr.length; i++) {
            buf[i] = arr[i];
        }
        return buf;
    }

    function generateCrc(data: number[]): number {
        let crc = SGP30_CRC8_INIT;

        for (let byte of data) {
            crc ^= byte;
            for (let _ = 0; _ < 8; _++) {
                if (crc & 0x80) {
                    crc = (crc << 1) ^ SGP30_CRC8_POLYNOMIAL;
                } else {
                    crc <<= 1;
                }
            }
        }

        return crc & 0xFF;
    }


    function _i2c_read_words_from_cmd(command: number[], delay: number, reply_size: number): number[] {
        // Runs an SGP command query, gets a reply, and CRC results if necessary

        // Send the command to the I2C device
        let buffer = numberArrayToBuffer(command);
        pins.i2cWriteBuffer(SGP30_DEFAULT_I2C_ADDR, buffer);

        // Delay for the specified time
        basic.pause(delay);

        if (reply_size === 0) {
            return null;
        }

        let crc_result = pins.i2cReadBuffer(SGP30_DEFAULT_I2C_ADDR, reply_size * (SGP30_WORD_LEN + 1), false);
        let result: number[] = [];

        for (let i = 0; i < reply_size; i++) {
            let word = [crc_result[3 * i], crc_result[3 * i + 1]];
            let crc = crc_result[3 * i + 2];

            if (generateCrc(word) !== crc) {
                return [-1];
            }

            result.push((word[0] << 8) | word[1]);
        }

        return result;
    }


    //////////////////////////////////////////////////////////////

    /**
    * Initialize SGP30
    */
    //% block="initialize sgp30"
    //% subcategory="co2 sgp30"
    export function iaqInit(): void {
        _i2c_read_words_from_cmd(
            SGP30_CMD_IAQ_INIT_HEX,
            SGP30_CMD_IAQ_INIT_MAX_MS,
            SGP30_CMD_IAQ_INIT_WORDS
        );
    }

    /**
    * Sample data from SGP30
    */
    //% block="sample sgp30"
    //% subcategory="co2 sgp30"
    export function measureIaq(): number[] {
        return _i2c_read_words_from_cmd(
            SGP30_CMD_MEASURE_IAQ_HEX,
            SGP30_CMD_MEASURE_IAQ_MS,
            SGP30_CMD_MEASURE_IAQ_WORDS
        );
    }

    /**
    * Get Iaq Baseline
    */
    //% block="get iaq baseline"
    //% subcategory="co2 sgp30"
    export function getIaqBaseline(): number[] {
        return _i2c_read_words_from_cmd(
            SGP30_CMD_GET_IAQ_BASELINE_HEX,
            SGP30_CMD_GET_IAQ_BASELINE_MAX_MS,
            SGP30_CMD_GET_IAQ_BASELINE_WORDS
        );
    }

    /**
    * Set IAQ Baseline
    * @param co2eq - co2eq
    * @param tvoc - tvoc
    */
    //% block="set iaq baseline |co2eq $co2eq tvoc $tvoc"
    //% subcategory="co2 sgp30"
    export function setIaqBaseline(co2eq: number, tvoc: number): number[] {
        if (co2eq === 0 && tvoc === 0) {
            return [-1];
        }

        let buffer: number[] = [];
        let values = [tvoc, co2eq];

        for (let value of values) {
            let arr: number[] = [value >> 8, value & 0xFF];
            arr.push(generateCrc(arr));
            buffer = buffer.concat(arr);
        }

        return _i2c_read_words_from_cmd(
            SGP30_CMD_SET_IAQ_BASELINE_HEX.concat(buffer),
            SGP30_CMD_SET_IAQ_BASELINE_MAX_MS,
            SGP30_CMD_SET_IAQ_BASELINE_WORDS
        );
    }

    /**
    * Set Absolute Humidity
    * @param co2eq - co2eq
    * @param tvoc - tvoc
    */
    //% block="set absolute humidity |absoluteHumidity $absoluteHumidity"
    //% subcategory="co2 sgp30"
    export function setAbsoluteHumidity(absoluteHumidity: number): number[] {
        let buffer: number[] = [];
        let arr: number[] = [absoluteHumidity >> 8, absoluteHumidity & 0xFF];
        arr.push(generateCrc(arr));
        buffer = buffer.concat(arr);

        return _i2c_read_words_from_cmd(
            SGP30_CMD_SET_ABSOLUTE_HUMIDITY_HEX.concat(buffer),
            SGP30_CMD_SET_ABSOLUTE_HUMIDITY_MAX_MS,
            SGP30_CMD_SET_ABSOLUTE_HUMIDITY_WORDS
        );
    }

    /**
    * Run Test Measure
    */
    //% block="run test measure"
    //% subcategory="co2 sgp30"
    export function measureTest(): number {
        let result = _i2c_read_words_from_cmd(
            SGP30_CMD_MEASURE_TEST_HEX,
            SGP30_CMD_MEASURE_TEST_MAX_MS,
            SGP30_CMD_MEASURE_TEST_WORDS
        );

        return result[0];
    }

    /**
    * Get Feature Set
    */
    //% block="get feature set"
    //% subcategory="co2 sgp30"
    export function getFeatureSet(): number {
        let result = _i2c_read_words_from_cmd(
            SGP30_CMD_GET_FEATURE_SET_HEX,
            SGP30_CMD_GET_FEATURE_SET_MAX_MS,
            SGP30_CMD_GET_FEATURE_SET_WORDS
        );

        return result[0];
    }

    /**
    * Get Raw Data
    */
    //% block="get raw data"
    //% subcategory="co2 sgp30"
    export function measureRaw(): number[] {
        let result = _i2c_read_words_from_cmd(
            SGP30_CMD_MEASURE_RAW_HEX,
            SGP30_CMD_MEASURE_RAW_MAX_MS,
            SGP30_CMD_MEASURE_RAW_WORDS
        );

        return result;
    }

    /**
    * Get Serial ID
    */
    //% block="get serial id"
    //% subcategory="co2 sgp30"
    export function getSerialId(): string {
        let serial = _i2c_read_words_from_cmd(
            SGP30_CMD_GET_SERIAL_ID_HEX,
            SGP30_CMD_GET_SERIAL_ID_MAX_MS,
            SGP30_CMD_GET_SERIAL_ID_WORDS
        );

        return serial.map(word => String.fromCharCode(word >> 8) + String.fromCharCode(word & 0xFF)).join('');
    }

    /**
    * Get Carbon Dioxide Equivalent in parts per million (ppm)
    */
    //% block="get co2eq (ppm)"
    //% subcategory="co2 sgp30"
    export function co2eq(): number {
        return measureIaq()[0];
    }

    /**
    * Get Total Volatile Organic Compound in parts per billion (ppb)
    */
    //% block="get tvoc (ppb)"
    //% subcategory="co2 sgp30"
    export function tvoc(): number {
        return measureIaq()[1];
    }

    /**
    * Get Carbon Dioxide Equivalent baseline value
    */
    //% block="get baseline co2eq"
    //% subcategory="co2 sgp30"
    export function baseline_co2eq(): number {
        return setIaqBaseline(co2eq(), tvoc())[0];
    }

    /**
    * Get Total Volatile Organic Compound baseline value
    */
    //% block="get baseline tvoc"
    //% subcategory="co2 sgp30"
    export function baseline_tvoc(): number {
        return getIaqBaseline()[1];
    }

    /**
    * Get Raw Hydrogen
    */
    //% block="get raw hydrogen"
    //% subcategory="co2 sgp30"
    export function raw_h2(): number {
        return measureRaw()[0];
    }

    /**
    * Get Raw Ethanol
    */
    //% block="get raw ethanol"
    //% subcategory="co2 sgp30"
    export function raw_ethanol(): number {
        return measureRaw()[1];
    }


    /**
    * Converts relative to absolute humidity as per the equation found in datasheet
    */
    //% block="relative to absolute humidity"
    //% subcategory="co2 sgp30"
    export function convertRelativeToAbsoluteHumidity(tempC: number, rHumidityPerc: number, fixedPoint: boolean = true): number {
        let aHumidityGm3 = 216.7 * ((rHumidityPerc / 100 * 6.112 * Math.exp(17.62 * tempC / (243.12 + tempC))) / (273.15 + tempC));

        if (fixedPoint) {
            aHumidityGm3 = (Math.floor(aHumidityGm3) << 8) + Math.floor((aHumidityGm3 % 1) * 256);
        }

        return aHumidityGm3;
    }

}