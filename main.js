const WIDTH = 256;
const HEIGHT = 128;


class LEDSimulator {
    constructor(canvasId, width = WIDTH, height = HEIGHT) {
        this.canvas = document.getElementById(canvasId);
        this.width = width;
        this.height = height;
        this.ledStates = new Uint8Array(width * height);
        this.gl = this.initWebGLContext();
        this.initShaderProgram();
        this.initBuffers(); // Uncomment this line
        this.initTexture();
        requestAnimationFrame(this.render.bind(this));
    }

    initWebGLContext() {
        const gl = this.canvas.getContext('webgl2'); // Change to webgl2
        if (!gl) {
            throw new Error('WebGL 2 is not supported');
        }
        gl.viewport(0, 0, this.width, this.height);
        gl.clearColor(0.1, 0.1, 0.1, 1.0);
        return gl;
    }

    initShaderProgram() {
        const vertexShader = `#version 300 es
        in vec4 aPosition;
        out vec2 vTexCoord;
        void main() {
            gl_Position = aPosition;
            // Flip texture coordinates
            vTexCoord = vec2(aPosition.x * 0.5 + 0.5, 0.5 - aPosition.y * 0.5);
        }`;

        const fragmentShader = `#version 300 es
        precision highp float;
        uniform sampler2D uTexture;
        in vec2 vTexCoord;
        out vec4 fragColor;
        
        void main() {
            // Sample size for blur - adjust these values ( at vec2(0.4) )  to control blur amount
            vec2 texelSize = vec2(0.2) / vec2(textureSize(uTexture, 0));
            float blur = 0.0;
            
            // 3x3 Gaussian blur kernel
            for(int i = -1; i <= 1; i++) {
                for(int j = -1; j <= 1; j++) {
                    vec2 offset = vec2(float(i), float(j)) * texelSize;
                    float weight = 1.0 / 9.0; // Equal weights for simple blur
                    blur += texture(uTexture, vTexCoord + offset).r * weight;
                }
            }

            // Mix between dark red and bright red based on blurred value
            fragColor = mix(vec4(0.2,0,0,1), vec4(1,0,0,1), blur);
        }`;

        // Compile vertex shader
        const vShader = this.gl.createShader(this.gl.VERTEX_SHADER);
        this.gl.shaderSource(vShader, vertexShader);
        this.gl.compileShader(vShader);

        // Compile fragment shader
        const fShader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
        this.gl.shaderSource(fShader, fragmentShader);
        this.gl.compileShader(fShader);

        // Create and link program
        this.program = this.gl.createProgram();
        this.gl.attachShader(this.program, vShader);
        this.gl.attachShader(this.program, fShader);
        this.gl.linkProgram(this.program);

        // Check for compilation errors
        if (!this.gl.getShaderParameter(vShader, this.gl.COMPILE_STATUS)) {
            console.error(this.gl.getShaderInfoLog(vShader));
        }
        if (!this.gl.getShaderParameter(fShader, this.gl.COMPILE_STATUS)) {
            console.error(this.gl.getShaderInfoLog(fShader));
        }
        if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
            console.error(this.gl.getProgramInfoLog(this.program));
        }

        // Use the program
        this.gl.useProgram(this.program);

        // Get attribute location
        this.positionAttributeLocation = this.gl.getAttribLocation(this.program, 'aPosition');
    }


    initBuffers() {
        // Create a 2x2 grid of vertices for each LED
        const positions = new Float32Array([
            // First LED
            -1.0, -1.0, // Bottom-left
            1.0, -1.0, // Bottom-right
            -1.0, 1.0, // Top-left
            1.0, 1.0, // Top-right
        ]);

        const positionBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);

        // Set up vertex attribute
        const vao = this.gl.createVertexArray();
        this.gl.bindVertexArray(vao);
        this.gl.enableVertexAttribArray(this.positionAttributeLocation);
        this.gl.vertexAttribPointer(this.positionAttributeLocation, 2, this.gl.FLOAT, false, 0, 0);
    }

    updateLED(x, y, state) {
        this.ledStates[y * this.width + x] = state ? 255 : 0;
    }

    initTexture() {
        this.texture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);

        // Set texture parameters
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);

        // Initialize texture data
        this.gl.texImage2D(
            this.gl.TEXTURE_2D,
            0,
            this.gl.R8,
            this.width,
            this.height,
            0,
            this.gl.RED,
            this.gl.UNSIGNED_BYTE,
            this.ledStates
        );
    }

    render() {
        this.gl.useProgram(this.program);

        // Update texture
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
        this.gl.texSubImage2D(
            this.gl.TEXTURE_2D,
            0,
            0,
            0,
            this.width,
            this.height,
            this.gl.RED,
            this.gl.UNSIGNED_BYTE,
            this.ledStates
        );

        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
        requestAnimationFrame(this.render.bind(this));
    }
}
class TextConverter {
    constructor(columns = WIDTH, rows = HEIGHT, charWidth = 5, charHeight = 7) {
        this.charMap = this.createFontMap();
        this.buffer = Array(rows).fill().map(() =>
            Array(columns).fill(0));
        this.charWidth = charWidth;
        this.charHeight = charHeight;
        this.lineSpacing = 2;
    }

    createFontMap() {
        return FONT1;
    }

    renderText(textLines) {
        let currentY = 0;
        for (const line of textLines) {
            this.renderLine(line, currentY);
            currentY += this.charHeight + this.lineSpacing;
        }
        return this.buffer;
    }

    renderLine(text, startY, toUppercase=false) {
        let currentX = 0;
        let text_ = toUppercase?text.toUpperCase():text;
        for (const char of text_) {
            const glyph = this.charMap[char] || [];
            for (let y = 0; y < this.charHeight; y++) {
                for (let x = 0; x < this.charWidth; x++) {
                    const state = (glyph[y] >> (this.charWidth - x - 1)) & 1;
                    this.buffer[startY + y][currentX + x] = state;
                }
            }
            currentX += this.charWidth + 1; // Add spacing between characters
        }
    }
}

class LEDDisplaySystem {
    constructor(canvasId) {
        this.simulator = new LEDSimulator(canvasId);
        this.converter = new TextConverter();
        this.currentText = [];
        this.displayBuffer = Array(HEIGHT).fill().map(() => Array(WIDTH).fill(0));
    }

    updateDisplay(textLines) {
        this.currentText = textLines;
        this.converter.buffer = this.displayBuffer.map(row => [...row.fill(0)]);
        const newBuffer = this.converter.renderText(textLines);
        this.applyBufferToSimulator(newBuffer);
    }

    applyBufferToSimulator(buffer) {
        for (let y = 0; y < buffer.length; y++) {
            for (let x = 0; x < buffer[y].length; x++) {
                this.simulator.updateLED(x, y, buffer[y][x]);
            }
        }
    }

    startDemo() {
        // Update the time immediately
        this.updateTimeDemo();
        // Set up an interval to update every second
        setInterval(() => this.updateTimeDemo(), 1000);
    }

    updateTimeDemo() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('de-DE'); // en-GB locale uses 24-hour format
        const demoText = [
            "",
            " "+timeString,
            "",
            this.formatBusTextDemo("1234",10),
            this.formatBusTextDemo("4 B",15),
            this.formatBusTextDemo("Express",2),
            this.formatBusTextDemo("Express solar",20000),
            "",
            //"!\\\"@§$%&/()=?`´+*#'-_.;^°<>~{|}[]"
        ];
        this.updateDisplay(demoText);
    }

    formatBusTextDemo(line, period) {
        const now = new Date();
        const btime = period - ( now.getMinutes() % period );
        const padLine = Math.max(line.length,8); // Exeptions in lenght should be visible
        const padTime = Math.max((""+btime).length,3); // Exeptions in lenght should be visible
        
        return " Bus line " + line.padEnd(padLine) + " arrives in " + (""+btime).padStart(padTime) + " minute" + (btime!=1?"s":"")
    }

}

class TouchController {
    constructor(simulator) {
        this.simulator = simulator;
        this.canvas = simulator.canvas;
        this.canvas.addEventListener('touchstart', this.handleTouch.bind(this));
        this.canvas.addEventListener('touchmove', this.handleTouch.bind(this));
    }

    handleTouch(event) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        for (const touch of event.touches) {
            const x = Math.floor((touch.clientX - rect.left) * scaleX);
            const y = Math.floor((touch.clientY - rect.top) * scaleY);

            if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) {
                this.simulator.updateLED(x, y, true);
            }
        }
        event.preventDefault();
    }
}


function configureCanvas() {
    const canvas = document.getElementById('ledCanvas');

    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;

    canvas.width = WIDTH; 
    canvas.height = HEIGHT; 

    const gl = canvas.getContext('webgl2'); // Change to webgl2
    if (gl) {
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    }
}

window.configureCanvas = configureCanvas;