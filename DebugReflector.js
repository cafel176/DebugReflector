// ============================================================================= //
// DebugReflector.js
// ============================================================================= //

/*:
 * @plugindesc 当前版本 V1
 * 调试反射器插件，适用于RMMZ和RMMV
 * @author cafel
 * @target MZ
 * @url https://github.com/cafel176/DebugReflector
 * @help QQ群：792888538 欢迎反馈遇到的问题和希望支持的功能
 * Project1：
 * 视频教程：
 * 
 * ★ 本插件提供如下支持：
 * 
 * 1. 按住F6可以选择查看任意视图组件的实际范围，包括UI，文本，图片，事件，角色等
 *    鼠标移动到其范围内即可出现黄色提示框
 *    ♦ 文本会额外显示蓝色提示框以表示文本最大宽度的范围
 *    ♦ 有时出现按住F6也不显示提示框的情况，可以按下ESC将之重置即可
 * 
 * 2. 显示黄色提示框时，鼠标点击它即可将之选中，提示框变为红色且不按F6时也不消失
 *    同时会在控制台输出选中物体的信息以及其创建时的调用堆栈
 *    ♦ 点选的物体会赋值给变量DebugReflector_ClickObject，可以通过脚本对其做任意处理
 * 
 * 3. 多个Sprite彼此重叠，范围相同的情况，想要选中特定的某个，可以按下F7使用限制器
 *    ♦ 在限制器窗口输入Sprite当前显示图片的图片名即可，如果输入空则表示无限制
 * 
 * 4. 支持实时显示鼠标当前窗口坐标，通过参数开关控制
 * 
 * 
 * ★ 本插件可以用于快速查看UI效果范围以实时调整，同时通过调用堆栈追溯文本
 *    和图片的坐标，帮助用户快速进行UI上的开发和调试
 * 
 * 
 * ★ 注意：本插件完全用于开发调试，开发完成后进入部署阶段时，请将本插件
 *    关闭避免影响到游戏流程
 * 
 * @param DebugReflector_ShowMousePos
 * @text 显示鼠标坐标
 * @desc 实时显示鼠标当前位置坐标
 * @default true
 * @type boolean
*/

var DebugReflector = DebugReflector || {};
DebugReflector.param = PluginManager.parameters('DebugReflector');

// ============================================================================= //
// 插件参数
// ============================================================================= //

const DebugReflector_ShowMousePos = (DebugReflector.param["DebugReflector_ShowMousePos"] === "true")

// ============================================================================= //
// 插件按键
// ============================================================================= //

// 调试按键
Input.keyMapper[27] = "ESC";
// F6
Input.keyMapper[117] = "reflector";
// F7
Input.keyMapper[118] = "filter";

// ============================================================================= //
// MV和MZ的兼容
// ============================================================================= //
if (Utils.RPGMAKER_NAME === 'MV') {
    TouchInput.isHovered = function () {
        return this.current_hovered
    }

    var DebugReflector_TouchInput_clear = TouchInput.clear
    TouchInput.clear = function () {
        DebugReflector_TouchInput_clear.call(this)
        this.current_hovered = false;
        this.new_hovered = false;
    };

    var DebugReflector_TouchInput_update = TouchInput.update
    TouchInput.update = function () {
        DebugReflector_TouchInput_update.call(this)
        this.current_hovered = this.new_hovered
        this.new_hovered = false
    };

    var DebugReflector_TouchInput_onMouseMove = TouchInput._onMouseMove
    TouchInput._onMouseMove = function (event) {
        DebugReflector_TouchInput_onMouseMove.call(this, event)

        var x = Graphics.pageToCanvasX(event.pageX);
        var y = Graphics.pageToCanvasY(event.pageY);
        if (!this._mousePressed && Graphics.isInsideCanvas(x, y)) {
            this._onHover(x, y);
        }
    }

    TouchInput._onHover = function (x, y) {
        this.new_hovered = true;
        this._x = x;
        this._y = y;
    }

    var DebugReflector_Container_calculateBounds = PIXI.Container.prototype.calculateBounds;
    PIXI.Container.prototype.calculateBounds = function calculateBounds() {
        for (var i = 0; i < this.children.length; i++) {
            var child = this.children[i];

            if (!child.visible || !child.renderable) {
                continue;
            }

            if (!child._bounds) {
                child._bounds = new PIXI.Bounds();
            }
        }

        DebugReflector_Container_calculateBounds.call(this)
    }
}
// ============================================================================= //
// 公共函数库
// ============================================================================= //

// MV和MZ的兼容
var DebugReflector_GetBounds = function (object) {
    if (!object) {
        bounds = new PIXI.Bounds();
        bounds.minX = 0;
        bounds.minY = 0;
        bounds.maxX = 0;
        bounds.maxY = 0;
        return bounds;
    }
    if (Utils.RPGMAKER_NAME === 'MV') {
        if (!object._bounds) {
            object._bounds = new PIXI.Bounds();
        }
        object.calculateBounds()
    }
    return object._bounds
}

// 限制bounds不要超出可见范围
var DebugReflector_LimitBounds = function (bounds) {
    if (!bounds) {
        bounds = new PIXI.Bounds();
        bounds.minX = 0;
        bounds.minY = 0;
        bounds.maxX = 0;
        bounds.maxY = 0;
    }
    else {
        bounds.minX = Math.max(bounds.minX, 0);
        bounds.minY = Math.max(bounds.minY, 0);
        bounds.maxX = Math.min(bounds.maxX, Graphics.width);
        bounds.maxY = Math.min(bounds.maxY, Graphics.height);
        // 处理文本最大宽度的绘制
        if ("minX_all" in bounds) {
            bounds.minX_all = Math.max(bounds.minX_all, 0);
        }
        if ("maxX_all" in bounds) {
            bounds.maxX_all = Math.min(bounds.maxX_all, Graphics.width);
        }
    }
    return bounds;
}

const DebugReflector_Priority = {
    // 其他
    "DebugReflector_TextInfo": 5,
    "DebugReflector_ImgInfo": 5,
    // Window
    "Window": 4,
    // Sprite
    "Sprite_Picture": 3,
    "Sprite_Character": 2,
    "Sprite_Actor": 2,
    "Sprite_Enemy": 2,
    "Spriteset": 0,
    "Sprite_Battleback": 0,
    "Sprite_MouseCursor": -100,// 鼠标指针给个特殊值
    // 必须放在最后，否则到他就不再继续往后搜索了
    "Sprite": 1,
};
// 判断点击对象的优先级，越大优先级越高
var DebugReflector_GetPriority = function (object) {
    if (!object) return -99;

    for (let key in DebugReflector_Priority) {
        if (object.constructor.name.includes(key)) {
            return DebugReflector_Priority[key];
        }
    }
    return -99;
}

// 检查鼠标是否在对象范围内
var DebugReflector_CheckTouched = function (inbounds) {
    const touchPos = new Point(TouchInput.x, TouchInput.y);
    const bounds = DebugReflector_LimitBounds(inbounds);
    return (bounds.minX <= touchPos.x && bounds.maxX >= touchPos.x &&
        bounds.minY <= touchPos.y && bounds.maxY >= touchPos.y);
}

// 清除已经绘制的提示
var DebugReflector_ClearClickGraphics = function () {
    if (!SceneManager._scene) return;

    if (('click_graphics' in SceneManager._scene) && SceneManager._scene.click_graphics) {
        if (SceneManager._scene.click_graphics._geometry || Utils.RPGMAKER_NAME === 'MV') {
            SceneManager._scene.click_graphics.clear();
        }
    }
}

// 清除已经绘制的提示
var DebugReflector_ClearHoverGraphics = function () {
    if (!SceneManager._scene) return;

    if (('hover_graphics' in SceneManager._scene) && SceneManager._scene.hover_graphics) {
        if (SceneManager._scene.hover_graphics._geometry || Utils.RPGMAKER_NAME === 'MV') {
            SceneManager._scene.hover_graphics.clear();
        }
    }
}

// 为对象绘制提示
var DebugReflector_DrawClickLines = function (object, offset, color) {
    if (!object) return;
    if (!SceneManager._scene) return;

    if (!('click_graphics' in SceneManager._scene) || !SceneManager._scene.click_graphics) {
        SceneManager._scene.click_graphics = new PIXI.Graphics();
        SceneManager._scene.addChild(SceneManager._scene.click_graphics);
        SceneManager._scene.click_graphics.position.set(0, 0);
        if (Utils.RPGMAKER_NAME === 'MZ') {
            if (!SceneManager._scene.click_graphics._lineStyle) {
                SceneManager._scene.click_graphics._lineStyle = new PIXI.LineStyle();
            }
        }
    }

    let DrawBounds = DebugReflector_LimitBounds(DebugReflector_GetBounds(object));
    DrawBounds.minX += offset;
    DrawBounds.minY += offset;
    DrawBounds.maxX -= offset;
    DrawBounds.maxY -= offset;

    const thickness = 5
    DebugReflector_ClearClickGraphics();

    // 处理文本最大宽度的绘制
    if ("minX_all" in DrawBounds) {
        SceneManager._scene.click_graphics.lineStyle(thickness, 0x7eaaff)
            .moveTo(DrawBounds.minX_all, DrawBounds.minY)
            .lineTo(DrawBounds.maxX_all, DrawBounds.minY)
            .lineTo(DrawBounds.maxX_all, DrawBounds.maxY)
            .lineTo(DrawBounds.minX_all, DrawBounds.maxY)
            .lineTo(DrawBounds.minX_all, DrawBounds.minY);
    }

    SceneManager._scene.click_graphics.lineStyle(thickness, color)
        .moveTo(DrawBounds.minX, DrawBounds.minY)
        .lineTo(DrawBounds.maxX, DrawBounds.minY)
        .lineTo(DrawBounds.maxX, DrawBounds.maxY)
        .lineTo(DrawBounds.minX, DrawBounds.maxY)
        .lineTo(DrawBounds.minX, DrawBounds.minY);
}

// 为对象绘制提示
var DebugReflector_DrawHoverLines = function (object, offset, color) {
    if (!object) return;
    if (!SceneManager._scene) return;

    if (!('hover_graphics' in SceneManager._scene) || !SceneManager._scene.hover_graphics) {
        SceneManager._scene.hover_graphics = new PIXI.Graphics();
        SceneManager._scene.addChild(SceneManager._scene.hover_graphics);
        SceneManager._scene.hover_graphics.position.set(0, 0);
        if (Utils.RPGMAKER_NAME === 'MZ')
        {
            if (!SceneManager._scene.hover_graphics._lineStyle) {
                SceneManager._scene.hover_graphics._lineStyle = new PIXI.LineStyle();
            }
        }
    }

    let DrawBounds = DebugReflector_LimitBounds(DebugReflector_GetBounds(object));
    DrawBounds.minX += offset;
    DrawBounds.minY += offset;
    DrawBounds.maxX -= offset;
    DrawBounds.maxY -= offset;

    const thickness = 4
    DebugReflector_ClearHoverGraphics();

    // 处理文本最大宽度的绘制
    if ("minX_all" in DrawBounds) {
        SceneManager._scene.hover_graphics.lineStyle(thickness, 0x7eaaff)
            .moveTo(DrawBounds.minX_all, DrawBounds.minY)
            .lineTo(DrawBounds.maxX_all, DrawBounds.minY)
            .lineTo(DrawBounds.maxX_all, DrawBounds.maxY)
            .lineTo(DrawBounds.minX_all, DrawBounds.maxY)
            .lineTo(DrawBounds.minX_all, DrawBounds.minY);
    }

    SceneManager._scene.hover_graphics.lineStyle(thickness, color)
        .moveTo(DrawBounds.minX, DrawBounds.minY)
        .lineTo(DrawBounds.maxX, DrawBounds.minY)
        .lineTo(DrawBounds.maxX, DrawBounds.maxY)
        .lineTo(DrawBounds.minX, DrawBounds.maxY)
        .lineTo(DrawBounds.minX, DrawBounds.minY);
}

// 按下开启调试反射器
var DebugReflector_IsReflectorEnabled = function () {
    return Input.isPressed("reflector");
}

// 离开调试时的处理
var DebugReflector_ExitHover = function (object) {
    if (!object || DebugReflector_HoverObject === object) {
        DebugReflector_HoverObject = null;
        DebugReflector_ClearHoverGraphics();
    }
}

// 离开调试时的处理
var DebugReflector_ExitClick = function (object) {
    if (!object || DebugReflector_ClickObject === object) {
        DebugReflector_ClickObject = null;
        DebugReflector_ClearClickGraphics();
    }
}

// 判断两个object是否存在父子关系
var DebugReflector_IfChild = function (child, parent) {
    // 检查是否是child
    let temp = child;
    while (temp) {
        if (temp.parent === parent) {
            return true
        }
        temp = temp.parent
    }
    return false
}

var DebugReflector_HoverObject = null;
var DebugReflector_ClickObject = null;
var DebugReflector_LastClickTime = 0;
// 对对象进行监控
var DebugReflector_DoDebugCheck = function (object, offset) {
    if (!object) return;

    if (DebugReflector_CheckTouched(DebugReflector_GetBounds(object))) {
        if (TouchInput.isHovered()) {
            let check = true
            // 决定本轮选择会选中谁
            if (DebugReflector_HoverObject) {
                const Priority = DebugReflector_GetPriority(object)
                // 特殊标记的不被选择
                if (Priority == -100) {
                    check = false
                }
                else {
                    let LastBounds = DebugReflector_LimitBounds(DebugReflector_GetBounds(DebugReflector_HoverObject));
                    let Bounds = DebugReflector_LimitBounds(DebugReflector_GetBounds(object));
                    // 检查是否将对方完全覆盖
                    if (Bounds.minX <= LastBounds.minX &&
                        Bounds.minY <= LastBounds.minY &&
                        Bounds.maxX >= LastBounds.maxX &&
                        Bounds.maxY >= LastBounds.maxY)
                    {
                        // 将对方完全包围
                        check = false
                    }
                    else {
                        // 检查优先级
                        const LastPriority = DebugReflector_GetPriority(DebugReflector_HoverObject)

                        // 优先级高
                        if (Priority > LastPriority) {
                            // 但是对方是自己的child
                            if (DebugReflector_IfChild(DebugReflector_HoverObject, object)) {
                                check = false
                            }
                        }
                        // 优先级低或相等
                        else {
                            // 自己不是对方的child
                            if (!DebugReflector_IfChild(object, DebugReflector_HoverObject)) {
                                // 检查是否被对方完全覆盖
                                if (LastBounds.minX > Bounds.minX ||
                                    LastBounds.minY > Bounds.minY ||
                                    LastBounds.maxX < Bounds.maxX ||
                                    LastBounds.maxY < Bounds.maxY) {
                                    // 没有被对方完全包围
                                    check = false
                                }
                            }
                        }
                    }
                }
            }

            // 触发选择
            if (check) {
                DebugReflector_HoverObject = object;
                // 如果不是已经点选，则可以画线
                if (DebugReflector_ClickObject !== object) {
                    DebugReflector_DrawHoverLines(object, offset, 0xffff1a)
                }
                // 已经点选了，清除线条
                else {
                    DebugReflector_ClearHoverGraphics();
                }
            }
        }
        if (TouchInput.isPressed()) {
            // 点选当前hover的对象
            if (DebugReflector_HoverObject === object) {
                let ClickTime = new Date().getTime() / 1000;
                // 避免过短时间内的反复触发
                if (ClickTime - DebugReflector_LastClickTime > 0.3) {
                    DebugReflector_LastClickTime = ClickTime;

                    DebugReflector_ClickObject = DebugReflector_HoverObject;
                    DebugReflector_DrawClickLines(DebugReflector_ClickObject, offset, 0xff1a1a)

                    console.log(DebugReflector_ClickObject)
                    console.log(DebugReflector_ClickObject.stack)
                }
            }
        }
    }
    else {
        // 离开hover范围
        DebugReflector_ExitHover(object);
    }
}

// ============================================================================= //
// 文本和图案信息
// ============================================================================= //

// 记录drawText信息
function DebugReflector_TextInfo() {
    this.initialize(...arguments);
}

DebugReflector_TextInfo.prototype.initialize = function (bitmap, text, x, y, maxWidth, lineHeight, align) {
    this.text = text
    this.x = x
    this.y = y
    this.maxWidth = maxWidth
    this.lineHeight = lineHeight
    this.align = align

    this.bitmap = bitmap
    this._bounds = new PIXI.Bounds();

    const err = new Error("Text在以下位置创建：");
    this.stack = err.stack;
}

DebugReflector_TextInfo.prototype.calculateBounds = function () {
    if (this.bitmap && this.bitmap.outer && DebugReflector_GetBounds(this.bitmap.outer)) {
        const padding = (("padding" in this.bitmap.outer) ? this.bitmap.outer.padding : 0)

        // 处理某些使用了scale的插件
        const TextScale = 1 / this.bitmap.outer.scale.x
        // 文本实际占用的宽度
        const TextWidth = this.bitmap.measureTextWidth(this.text) / TextScale;
        // 文本最大占用宽度
        const maxWidth = this.maxWidth / TextScale
        // lineHeight是行间距
        const lineHeight = this.lineHeight / TextScale
        // outlineWidth是描边粗细
        const outlineWidth = this.bitmap.outlineWidth / TextScale
        // 字体大小
        const fontSize = this.bitmap.fontSize / TextScale

        const minX = ((this.align === "center") ? this.x + maxWidth / 2 - TextWidth / 2 : ((this.align === "right") ? this.x + maxWidth - TextWidth : this.x)) + this.bitmap.outer._bounds.minX + padding - outlineWidth
        const minX_all = this.x + this.bitmap.outer._bounds.minX + padding - outlineWidth
        const maxY = Math.round(this.y + lineHeight / 2 + fontSize / 2) + this.bitmap.outer._bounds.minY + padding

        this._bounds.minX = minX
        this._bounds.maxX = this._bounds.minX + TextWidth + outlineWidth * 2

        this._bounds.minX_all = minX_all
        this._bounds.maxX_all = this._bounds.minX_all + maxWidth + outlineWidth * 2

        this._bounds.maxY = maxY + outlineWidth
        this._bounds.minY = this._bounds.maxY - fontSize - outlineWidth * 2
    }
}

DebugReflector_TextInfo.prototype.update = function () {
    this.calculateBounds()

    if (DebugReflector_IsReflectorEnabled()) {
        if (this.canReflectorSelect()) {
            DebugReflector_DoDebugCheck(this, 0);
        }
        else {
            DebugReflector_ExitHover(this);
            DebugReflector_ExitClick(this);
        }
    }
    else {
        DebugReflector_ExitHover(this);
    }
}

DebugReflector_TextInfo.prototype.canReflectorSelect = function () {
    if (this.bitmap && this.bitmap.outer && (typeof (this.bitmap.outer.canReflectorSelect) != "undefined")) {
        return this.bitmap.outer.canReflectorSelect()
    }
    return true
}

// 记录blt信息
function DebugReflector_ImgInfo() {
    this.initialize(...arguments);
}

DebugReflector_ImgInfo.prototype.initialize = function (bitmap, source, sx, sy, sw, sh, dx, dy, dw, dh) {
    this.source = source
    this.sx = sx
    this.sy = sy
    this.sw = sw
    this.sh = sh
    this.dx = dx
    this.dy = dy
    this.dw = dw
    this.dh = dh

    this.bitmap = bitmap
    this._bounds = new PIXI.Bounds();

    const err = new Error("Image在以下位置创建：");
    this.stack = err.stack;
}

DebugReflector_ImgInfo.prototype.calculateBounds = function () {
    if (this.bitmap && this.bitmap.outer && DebugReflector_GetBounds(this.bitmap.outer)) {
        let padding = (("padding" in this.bitmap.outer) ? this.bitmap.outer.padding : 0)

        this._bounds.minX = this.dx + this.bitmap.outer._bounds.minX + padding;
        this._bounds.minY = this.dy + this.bitmap.outer._bounds.minY + padding;
        this._bounds.maxX = this._bounds.minX + this.dw;
        this._bounds.maxY = this._bounds.minY + this.dh;
    }
}

DebugReflector_ImgInfo.prototype.update = function () {
    this.calculateBounds()

    if (DebugReflector_IsReflectorEnabled()) {
        if (this.canReflectorSelect()) {
            DebugReflector_DoDebugCheck(this, 0);
        }
        else {
            DebugReflector_ExitHover(this);
            DebugReflector_ExitClick(this);
        }
    }
    else {
        DebugReflector_ExitHover(this);
    }
}

DebugReflector_ImgInfo.prototype.canReflectorSelect = function () {
    if (this.bitmap && this.bitmap.outer && (typeof (this.bitmap.outer.canReflectorSelect) != "undefined")) {
        return this.bitmap.outer.canReflectorSelect()
    }
    return true
}

// ============================================================================= //
// 监控文本和图案
// ============================================================================= //

var DebugReflector_Bitmap_initialize = Bitmap.prototype.initialize;
Bitmap.prototype.initialize = function (width, height) {
    DebugReflector_Bitmap_initialize.call(this, width, height)

    this.outer = null
    // 用于记录绘制过的文本
    this.textInfos = []
    // 用于记录绘制过的图案
    this.imgInfos = []
}

var DebugReflector_Bitmap_drawText = Bitmap.prototype.drawText;
Bitmap.prototype.drawText = function (text, x, y, maxWidth, lineHeight, align) {
    DebugReflector_Bitmap_drawText.call(this, text, x, y, maxWidth, lineHeight, align)
    if (this) {
        maxWidth = maxWidth || 0xffffffff;

        this.textInfos.push(new DebugReflector_TextInfo(this, text, x, y, maxWidth, lineHeight, align))
    }
}

var DebugReflector_Bitmap_blt = Bitmap.prototype.blt;
Bitmap.prototype.blt = function (source, sx, sy, sw, sh, dx, dy, dw, dh) {
    DebugReflector_Bitmap_blt.call(this, source, sx, sy, sw, sh, dx, dy, dw, dh)
    if (this) {
        dw = dw || sw;
        dh = dh || sh;

        this.imgInfos.push(new DebugReflector_ImgInfo(this, source, sx, sy, sw, sh, dx, dy, dw, dh))
    }
}

var DebugReflector_Bitmap_clear = Bitmap.prototype.clear;
Bitmap.prototype.clear = function () {
    DebugReflector_Bitmap_clear.call(this)
    this.textInfos.forEach((item, index, arr) => {
        DebugReflector_ExitHover(item);
        DebugReflector_ExitClick(item);
    })
    this.textInfos = []
    this.imgInfos.forEach((item, index, arr) => {
        DebugReflector_ExitHover(item);
        DebugReflector_ExitClick(item);
    })
    this.imgInfos = []
}

Bitmap.update = function (bitmap) {
    if (!bitmap) return
    if (!("textInfos" in bitmap)) return
    if (!("imgInfos" in bitmap)) return

    bitmap.textInfos.forEach((item, index, arr) => {
        item.update()
    })
    bitmap.imgInfos.forEach((item, index, arr) => {
        item.update()
    })
}

// ============================================================================= //
// 添加监控
// ============================================================================= //

var DebugReflector_Sprite_initialize = Sprite.prototype.initialize;
Sprite.prototype.initialize = function (bitmap) {
    DebugReflector_Sprite_initialize.call(this, bitmap);

    if (this._bitmap) {
        this._bitmap.outer = this
    }
};

var DebugReflector_Sprite_update = Sprite.prototype.update;
Sprite.prototype.update = function () {
    DebugReflector_Sprite_update.call(this);

    if (DebugReflector_IsReflectorEnabled()) {
        if (this.canReflectorSelect()) {
            DebugReflector_DoDebugCheck(this, 0);
        }
        else {
            DebugReflector_ExitHover(this);
            DebugReflector_ExitClick(this);
        }
    }
    else {
        DebugReflector_ExitHover(this);
    }

    if (this._bitmap) {
        Bitmap.update(this._bitmap)
    }
}

var DebugReflector_Hover_Sprite_Filter = "";
Sprite.prototype.canReflectorSelect = function () {
    if (this._hidden) {
        return false
    }

    // 图片选择限制优先
    if (DebugReflector_Hover_Sprite_Filter !== "") {
        if (this._bitmap && this._bitmap._image) {
            return this._bitmap._image.src.includes(DebugReflector_Hover_Sprite_Filter)
        }
        else {
            return false
        }
    }

    if (this.parent && (typeof (this.parent.canReflectorSelect) != "undefined")) {
        return this.parent.canReflectorSelect()
    }
    return true
}

var DebugReflector_Window_Base_createContents = Window_Base.prototype.createContents;
Window_Base.prototype.createContents = function () {
    DebugReflector_Window_Base_createContents.call(this);

    if (this.contents) {
        this.contents.outer = this
    }
};

var DebugReflector_Window_Base_update = Window_Base.prototype.update;
Window_Base.prototype.update = function () {
    DebugReflector_Window_Base_update.call(this);

    if (DebugReflector_IsReflectorEnabled()) {
        if (this.canReflectorSelect()) {
            DebugReflector_DoDebugCheck(this, 0);
        }
        else {
            DebugReflector_ExitHover(this);
            DebugReflector_ExitClick(this);
        }
    }
    else {
        DebugReflector_ExitHover(this);
    }

    if (this.contents) {
        Bitmap.update(this.contents)
    }
}

Window_Base.prototype.canReflectorSelect = function () {
    // 某些多窗口scene中，有些窗口没有active但也应该被选中，故这里不判断active
    if (!this.isOpen() || !this.visible) {
        return false
    }
    if (this.parent && (typeof (this.parent.canReflectorSelect) != "undefined")) {
        return this.parent.canReflectorSelect()
    }
    return true
}

var DebugReflector_LastDrawMouseTime = 0;

var DebugReflector_Scene_Base_update = Scene_Base.prototype.update;
Scene_Base.prototype.update = function () {
    DebugReflector_Scene_Base_update.call(this);

    // 图片选择限制
    if (Input.isTriggered("filter")) {
        let re = prompt("请输入想选择的图片文件名，空为不做任何限制", DebugReflector_Hover_Sprite_Filter);
        // null是取消的情况
        if (re !== null) {
            DebugReflector_Hover_Sprite_Filter = re
            if (DebugReflector_Hover_Sprite_Filter !== "") {
                console.log("选择的图片文件名包含：" + DebugReflector_Hover_Sprite_Filter)
            }
            else {
                console.log("清除选择的图片文件名限制")
            }
        }
    }

    // 按下ESC清除当前选择以处理偶尔系统选择卡死
    if (Input.isTriggered("ESC")) {
        DebugReflector_ExitHover(null);
        DebugReflector_ExitClick(null);
    }

    // 实时绘制鼠标位置
    if (DebugReflector_ShowMousePos && SceneManager._scene === this) {
        // 避免过短时间内的反复触发
        let ClickTime = new Date().getTime() / 1000;
        if (ClickTime - DebugReflector_LastDrawMouseTime > 0.03) {
            DebugReflector_LastDrawMouseTime = ClickTime;

            if (('DebugReflector_text_sprite' in this) && this.DebugReflector_text_sprite && this.DebugReflector_text_sprite.bitmap) {
                this.DebugReflector_text_sprite.bitmap.clear()
            }
            if (DebugReflector_IsReflectorEnabled()) {
                if (!('DebugReflector_text_sprite' in this) || !this.DebugReflector_text_sprite) {
                    // 这里Scene_Map的width和height太大了导致出现警告无法绘制，需要限制
                    this.DebugReflector_text_sprite = new Sprite(new Bitmap(Math.min(this.width, Graphics.width), Math.min(this.height, Graphics.height)));
                    this.DebugReflector_text_sprite.bitmap.fontSize = 20;
                    if (Utils.RPGMAKER_NAME === 'MZ') {
                        this.DebugReflector_text_sprite.bitmap.fontFace = $gameSystem.mainFontFace();
                        this.DebugReflector_text_sprite.bitmap.textColor = ColorManager.normalColor();
                        this.DebugReflector_text_sprite.bitmap.outlineColor = ColorManager.outlineColor();
                    }
                    this.DebugReflector_text_sprite.x = this.x;
                    this.DebugReflector_text_sprite.y = this.y;
                    this.addChild(this.DebugReflector_text_sprite);
                }

                const MouseHint = "(" + TouchInput.x + ", " + TouchInput.y + ")"
                const TextWidth = this.DebugReflector_text_sprite.bitmap.measureTextWidth(MouseHint)

                let minX = TouchInput.x + 15
                if (minX < 0) {
                    minX = 0
                }
                let maxX = minX + TextWidth
                if (maxX > Graphics.width) {
                    maxX = Graphics.width
                    minX = maxX - TextWidth
                }
                let minY = TouchInput.y + 15
                if (minY < 0) {
                    minY = 0
                }
                let maxY = minY + this.DebugReflector_text_sprite.bitmap.fontSize
                if (maxY > Graphics.height) {
                    maxY = Graphics.height
                    minY = maxY - this.DebugReflector_text_sprite.bitmap.fontSize
                }

                this.DebugReflector_text_sprite.bitmap.drawText(MouseHint, minX, minY, TextWidth, this.DebugReflector_text_sprite.bitmap.fontSize, "center");
            }
        }
    }
}

// ============================================================================= //
// 记录创建堆栈
// ============================================================================= //

var DebugReflector_Container_addChild = PIXI.Container.prototype.addChild;
PIXI.Container.prototype.addChild = function (param) {
    DebugReflector_Container_addChild.call(this, param)

    const err = new Error(param.constructor.name + "在以下位置创建：");
    param.stack = err.stack;
}