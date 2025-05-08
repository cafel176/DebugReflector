// ============================================================================= //
// DebugReflector.js
// ============================================================================= //
/*:
 * @plugindesc 当前版本 V2
 * 运行时事件调试插件，适用于RMMZ和RMMV
 * @author cafel
 * @target MZ
 * @url https://github.com/cafel176/RuntimeEventDebug
 * @help QQ群：792888538  
 * Project1：https://rpg.blue/thread-497192-1-1.html
 * 视频教程：https://www.bilibili.com/video/BV1YURqYMETS/?spm_id_from=333.337.search-card.all.click&vd_source=1f5e08d6a2e054c354714c7090aed591
 * 
 * ★ 本插件提供如下支持：
 * 
 * 1. 支持通过注释在事件列表中添加断点，运行时执行到断点注释会触发存档面板以供
 *    记录
 *    ♦ 使用方式：添加注释并写入“断点#任意字符”即可
 *      此处的任意字符要保证每个事件内的所有事件页都不重复
 *    ♦ 例如：事件A内3个事件页，则事件页1用了断点#001，其他断点都不能再用，当前
 *      事件页和事件页2、3内的所有其他断点都不能再用001
 *      但是另外一个事件B则无此限制，每个事件是彼此独立的
 * 
 * 2. 支持运行时在任意时间打开读档界面，快捷键F10
 * 
 * 3. 支持运行时对事件进行调试编辑，当在注释断点处保存游戏后，再次读档会识别上
 *    次保存的注释断点位置，并将最新的修改直接应用到该位置
 *    ♦ 注意：本功能仅限通过注释断点保存的存档，其他插件或普通的存档事件无法
 *      触发
 * 
 * ★ 结合各种功能后，对于一个长流程事件演出的调试工作流如下：
 *    ♦ 在事件列表中要检查的位置之前加入注释断点
 *    ♦ 开始游戏，进入事件测试
 *    ♦ 触发断点，保存
 *    ♦ 执行事件，检查效果是否满意
 *    ♦ 如效果未达预期，直接在编辑器中对事件进行修改
 *    ♦ 此时注意，一定要保存工程！！！
 *    ♦ F10读档，再次进行事件测试，如仍不满意，重复上述流程
 *    ♦ 如效果达到预期，则可以退出游戏
 * 
 * ★ 注意：本插件完全用于开发调试，开发完成后进入部署阶段时，请将本插件
 *    关闭避免影响到游戏流程
 * 
 * @param 断点方式
 * @type select
 * @option 仅注释处
 * @value 仅注释处
 * @option 禁用
 * @value 禁用
 * @desc 断点触发存档界面的方式
 * @default 仅注释处
 * 
 */

var DebugReflector = DebugReflector || {};
DebugReflector.param = PluginManager.parameters('DebugReflector');

// ============================================================================= //
// 插件按键
// ============================================================================= //

// 调试按键
Input.keyMapper[27] = "ESC";
Input.keyMapper[114] = "reflector";
Input.keyMapper[115] = "filter";

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
    "Sprite_MouseCursor": -100,
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
        const TextWidth = this.bitmap.measureTextWidth(this.text);
        // outlineWidth是描边粗细
        const minX = ((this.align === "center") ? this.x + this.maxWidth / 2 - TextWidth / 2 : ((this.align === "right") ? this.x + this.maxWidth - TextWidth : this.x)) + this.bitmap.outer._bounds.minX + padding - this.bitmap.outlineWidth
        // lineHeight是行间距
        const maxY = Math.round(this.y + this.lineHeight / 2 + this.bitmap.fontSize / 2) + this.bitmap.outer._bounds.minY + padding

        this._bounds.minX = minX
        this._bounds.maxX = this._bounds.minX + TextWidth + this.bitmap.outlineWidth * 2

        this._bounds.maxY = maxY + this.bitmap.outlineWidth
        this._bounds.minY = this._bounds.maxY - this.bitmap.fontSize - this.bitmap.outlineWidth * 2
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
    if (!this.isOpen() || !this.visible) {
        return false
    }
    if (this.parent && (typeof (this.parent.canReflectorSelect) != "undefined")) {
        return this.parent.canReflectorSelect()
    }
    return true
}

var DebugReflector_Scene_Base_update = Scene_Base.prototype.update;
Scene_Base.prototype.update = function () {
    DebugReflector_Scene_Base_update.call(this);

    if (Input.isTriggered("filter")) {
        DebugReflector_Hover_Sprite_Filter = prompt("请输入想选择的图片文件名，空为不做任何限制", "");
        if (DebugReflector_Hover_Sprite_Filter === null) {
            DebugReflector_Hover_Sprite_Filter = ""
        }
        if (DebugReflector_Hover_Sprite_Filter !== "") {
            console.log("选择的图片文件名包含：" + DebugReflector_Hover_Sprite_Filter)
        }
        else {
            console.log("清除选择的图片文件名限制")
        }
    }
    if (Input.isTriggered("ESC")) {
        DebugReflector_ExitHover(null);
        DebugReflector_ExitClick(null);
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