const gl = require("gl");
const ctx = gl(1, 1, { preserveDrawingBuffer: true });
console.log("GL version:", ctx.getParameter(ctx.VERSION));
console.log("GL renderer:", ctx.getParameter(ctx.RENDERER));
const ext = ctx.getExtension("STACKGL_destroy_context");
if (ext) ext.destroy();
console.log("GL test passed");
