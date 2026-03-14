const uploadUrl = "";
const uploadField = "";

const Delay = (typeof window.Delay === 'function') ? window.Delay : (ms) => new Promise(r => setTimeout(r, ms));

import { CfxTexture, LinearFilter, Mesh, NearestFilter, OrthographicCamera, PlaneBufferGeometry, RGBAFormat, Scene, ShaderMaterial, UnsignedByteType, WebGLRenderTarget, WebGLRenderer } from "/module/Three.js";

var isAnimated = false;
var MainRender;
var scId = 0;
var pixelBuffer = null;
var imageData = null;

// from https://stackoverflow.com/a/12300351
function dataURItoBlob(dataURI) {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]

    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
  
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
  
    const blob = new Blob([ab], {type: mimeString});
    return blob;
}

// citizenfx/screenshot-basic
class GameRender {
    constructor() {
        window.addEventListener('resize', this.resize);

        const cameraRTT = new OrthographicCamera(window.innerWidth / -2, window.innerWidth / 2, window.innerHeight / 2, window.innerHeight / -2, -10000, 10000);
        cameraRTT.position.z = 0;
        cameraRTT.setViewOffset(window.innerWidth, window.innerHeight, 0, 0, window.innerWidth, window.innerHeight);

        const sceneRTT = new Scene();

        const rtTexture = new WebGLRenderTarget(window.innerWidth, window.innerHeight, {minFilter: LinearFilter, magFilter: NearestFilter, format: RGBAFormat, type: UnsignedByteType});
        const gameTexture = new CfxTexture();
        gameTexture.needsUpdate = true;

        const material = new ShaderMaterial({
            uniforms: { "tDiffuse": { value: gameTexture } },
            vertexShader: `
			varying vec2 vUv;

			void main() {
				vUv = vec2(uv.x, 1.0-uv.y);
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			}
`,
            fragmentShader: `
			varying vec2 vUv;
			uniform sampler2D tDiffuse;

			void main() {
				gl_FragColor = texture2D(tDiffuse, vUv);
			}
`
        });

        this.material = material;

        const plane = new PlaneBufferGeometry(window.innerWidth, window.innerHeight);
        const quad = new Mesh(plane, material);
        quad.position.z = -100;
        sceneRTT.add(quad);

        const renderer = new WebGLRenderer({ powerPreference: 'high-performance', antialias: false, preserveDrawingBuffer: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.autoClear = false;

        let appendArea = document.createElement("div");
        appendArea.id = "three-game-render";

        document.body.append(appendArea);

        appendArea.appendChild(renderer.domElement);
        appendArea.style.display = 'none';

        this.renderer = renderer;
        this.rtTexture = rtTexture;
        this.sceneRTT = sceneRTT;
        this.cameraRTT = cameraRTT;
        this.gameTexture = gameTexture;

        this.animate = this.animate.bind(this);

        requestAnimationFrame(this.animate);
    }

    resize(screenshot) {
        const cameraRTT = new OrthographicCamera(window.innerWidth / -2, window.innerWidth / 2, window.innerHeight / 2, window.innerHeight / -2, -10000, 10000);
        cameraRTT.setViewOffset(window.innerWidth, window.innerHeight, 0, 0, window.innerWidth, window.innerHeight);

        this.cameraRTT = cameraRTT;

        const sceneRTT = new Scene();

        const plane = new PlaneBufferGeometry(window.innerWidth, window.innerHeight);
        const quad = new Mesh(plane, this.material);
        quad.position.z = -100;
        sceneRTT.add(quad);

        this.sceneRTT = sceneRTT;

        this.rtTexture = new WebGLRenderTarget(window.innerWidth, window.innerHeight, {minFilter: LinearFilter, magFilter: NearestFilter, format: RGBAFormat, type: UnsignedByteType});

        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(this.animate);
        if (!isAnimated || !this.canvas) return;
        this.renderer.clear();
        this.renderer.render(this.sceneRTT, this.cameraRTT, this.rtTexture, true);
        const w = window.innerWidth;
        const h = window.innerHeight;
        const size = w * h * 4;
        if (!pixelBuffer || pixelBuffer.length !== size) {
            pixelBuffer = new Uint8Array(size);
        }
        this.renderer.readRenderTargetPixels(this.rtTexture, 0, 0, w, h, pixelBuffer);
        if (!imageData || imageData.width !== w || imageData.height !== h) {
            imageData = new ImageData(w, h);
        }
        imageData.data.set(pixelBuffer);
        const cxt = this.canvas.getContext('2d');
        if (this.canvas.width !== w || this.canvas.height !== h) {
            this.canvas.width = w;
            this.canvas.height = h;
        }
        cxt.putImageData(imageData, 0, 0);
    }

    createTempCanvas() {
        this.canvas = document.createElement("canvas");
        this.canvas.style.display = 'inline';
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    renderToTarget(element) {
        this.resize(false);
        this.canvas = element;
        isAnimated = true;
    }

    requestScreenshot = (url, field) => new Promise(async (res) => {
        console.time("requestScreenshot");
        this.createTempCanvas();
        url = url ? url : uploadUrl;
        field = field ? field : uploadField;
        isAnimated = true;
        await Delay(10);
        const imageURL = this.canvas.toDataURL("image/jpeg", 0.92);
        const formData = new FormData();
        formData.append(field, dataURItoBlob(imageURL), `screenshot.png`);

        fetch(url, {
            method: 'POST',
            mode: 'cors',
            body: formData
        })
        .then(response => response.text())
        .then(text => {
            text = JSON.parse(text);
            if (text.success) {
                console.timeEnd("requestScreenshot");
                res(text.files[0]);
            } else {
                res(false);
            }
            scId++;
            isAnimated = false;
            this.canvas.remove();
            this.canvas = false;
        });
    })

    stop() {
        isAnimated = false;
        if (this.canvas) {
            if (this.canvas.style && this.canvas.style.display !== 'none') {
                this.canvas.style.display = 'none';
            }
        }
        this.resize(true);
    }
}

setTimeout(() => {
    MainRender = new GameRender();
    window.MainRender = MainRender;
    window.cfxrender = {
        renderToTarget: (element) => MainRender.renderToTarget(element),
        stop: () => MainRender.stop(),
        requestScreenshot: (url, field) => MainRender.requestScreenshot(url, field)
    };
}, 500);
