# ============================================================================= //
# DebugReflector
# ============================================================================= //
#
# 当前版本：V1
# 调试反射器插件，适用于RMVA、RMVX
# 作者： cafel
# QQ群：792888538
# github地址：https://github.com/cafel176/DebugReflector
# Project1：
# 视频教程：
# 
# ★ 本插件提供如下支持：
# 
# 1. 按住F6可以选择查看任意视图组件的实际范围，包括UI，文本，图片，事件，角色等
#    鼠标移动到其范围内即可出现黄色提示框
#    ♦ 文本会额外显示蓝色提示框以表示文本最大宽度的范围
#    ♦ 有时出现按住F6也不显示提示框的情况，可以按下W将之重置即可
# 
# 2. 显示黄色提示框时，鼠标点击它即可将之选中，提示框变为红色且不按F6时也不消失
#    同时会在控制台输出选中物体的信息以及其创建时的调用堆栈
#    ♦ 点选的物体会赋值给变量$DebugReflector_ClickObject，可以通过脚本对其做任意处理
# 
# 3. 支持实时显示鼠标当前窗口坐标，通过$debug_reflector_show_mouse_pos开关控制
# 
# ★ 本插件可以用于快速查看UI效果范围以实时调整，同时通过调用堆栈追溯文本
#    和图片的坐标，帮助用户快速进行UI上的开发和调试
# 
# ★ 注意：本插件完全用于开发调试，开发完成后进入部署阶段时，请将$debug_reflector_active关闭避免影响到游戏流程
# 
# 参考文献：https://rpg.blue/thread-222236-1-1.html
#           https://rpg.blue/thread-102327-1-1.html
# 感谢大佬们的研究
# 

# ============================================================================= 
# 插件配置
# ============================================================================= 

# RM版本
$debug_reflector_rm_version = (self ? RUBY_VERSION == "1.9.2" ? "VA" : "VX" : "XP")

# 控制插件是否生效
$debug_reflector_active = true

# 实时绘制鼠标位置
$debug_reflector_show_mouse_pos = true

# 文本最大范围提示颜色
$debug_reflector_hover_color_all = Color.new(126, 170, 255)

# hover提示颜色
$debug_reflector_hover_color = Color.new(255, 255, 26)

# click提示颜色
$debug_reflector_click_color = Color.new(255, 26, 26)

# ============================================================================= 
# Windows API 函数
# ============================================================================= 

$DebugReflector_GetWindowThreadProcessId = Win32API.new("user32", "GetWindowThreadProcessId", "LP", "L")
$DebugReflector_GetWindow = Win32API.new("user32", "GetWindow", "LL", "L")
$DebugReflector_GetClassName = Win32API.new("user32", "GetClassName", "LPL", "L")
$DebugReflector_GetCurrentThreadId = Win32API.new("kernel32", "GetCurrentThreadId", "V", "L")
$DebugReflector_GetForegroundWindow = Win32API.new("user32", "GetForegroundWindow", "V", "L")
$DebugReflector_GetCursorPos = Win32API.new('user32', 'GetCursorPos', %w(p), 'l')
if self #VA VX
  $DebugReflector_SendMessage = Win32API.new('user32.dll','SendMessageW','iiii','i')
else # XP
  $DebugReflector_SendMessage = Win32API.new('user32.dll','DefWindowProcA','iiii','i')
end
$DebugReflector_GetWindowRect = Win32API.new('user32','GetWindowRect',['l','p'],'i')
$DebugReflector_GetClientRect = Win32API.new('user32','GetClientRect',['l','p'],'i')
$DebugReflector_GetAsyncKeyState = Win32API.new('user32','GetAsyncKeyState', ['p'], 'i')

# ============================================================================= 
# 内置类修改
# ============================================================================= 

class Bitmap
  attr_accessor :outer

  def set_outer(in_outer)
    @outer = in_outer
    # 用于记录绘制过的文本
    @textInfos = Array.new
    # 用于记录绘制过的图案
    @imgInfos = Array.new

    # 显示光标
    if @outer.class.name.include?("Window")
      @cursor = DebugReflector_ImgInfo.new(self, "Cursor", 0, 0, 0, 0, @outer.cursor_rect.x, @outer.cursor_rect.y, @outer.cursor_rect.width, @outer.cursor_rect.height)
    end
  end

  alias debug_reflector_origin_draw_text draw_text
  def draw_text(*args)
    debug_reflector_origin_draw_text(*args)
    # 非active下不执行
    return if !$debug_reflector_active

    # 不用Rect的重载
    if args[0].class.name == "Fixnum"
      if @textInfos
        @textInfos.push(DebugReflector_TextInfo.new(self, args[4], args[0], args[1], args[2], args[3], args[5]))
      end
    else # 用Rect的重载
      if @textInfos
        @textInfos.push(DebugReflector_TextInfo.new(self, args[1], args[0].x, args[0].y, args[0].width, args[0].height, args[2]))
      end
    end
  end

  alias debug_reflector_origin_blt blt
  def blt(x, y, src_bitmap, src_rect, opacity = 255)
    debug_reflector_origin_blt(x, y, src_bitmap, src_rect, opacity)
    # 非active下不执行
    return if !$debug_reflector_active

    if @imgInfos
      @imgInfos.push(DebugReflector_ImgInfo.new(self, src_bitmap, src_rect.x, src_rect.y, src_rect.width, src_rect.height, x, y, src_rect.width, src_rect.height))
    end
  end

  alias debug_reflector_origin_clear clear
  def clear
    debug_reflector_origin_clear
    # 非active下不执行
    return if !$debug_reflector_active

    if @textInfos
      @textInfos.each do |value|
        DebugUtils.exit_hover(value)
        DebugUtils.exit_click(value)
      end
      @textInfos.clear
    end
    if @imgInfos
      @imgInfos.each do |value|
        DebugUtils.exit_hover(value)
        DebugUtils.exit_click(value)
      end
      @imgInfos.clear
    end
  end

  def update
    if @textInfos
      @textInfos.each do |value|
        value.update
      end
    end
    if @imgInfos
      @imgInfos.each do |value|
        value.update
      end
    end

    if @cursor
      @cursor.set(@outer.cursor_rect.x, @outer.cursor_rect.y, @outer.cursor_rect.width, @outer.cursor_rect.height)
      @cursor.update
    end
  end

  def drawline(x1, y1, x2, y2, width, color)
    x1 = x1.to_f
    y1 = y1.to_f
    x2 = x2.to_f
    y2 = y2.to_f
    width = width.to_f
    k = (y2 - y1) / (x2 - x1)
    if k.abs > 1
      drawline_x(x1, y1, x2, y2, width, color)
    else
      drawline_y(x1, y1, x2, y2, width, color)
    end
  end

  def drawline_x(x1, y1, x2, y2, width, color)
    l = ((x1 - x2) ** 2 + (y1 - y2) ** 2) ** 0.5 * width / (y1 - y2)
    length = l.abs * 2
    k = (x2 - x1) / (y2 - y1) #x=ky+b
    b = x1 - k * y1
    if l > 0
      for ty in y2.to_i..y1.to_i
        tx = ty * k + b
        fill_rect(tx - l, ty, length, 1, color)
      end
    else
      for ty in y1.to_i..y2.to_i
        tx = ty * k + b
        fill_rect(tx + l, ty, length, 1, color)
      end
    end
  end

  def drawline_y(x1, y1, x2, y2, width, color)
    l = ((x1 - x2) ** 2 + (y1 - y2) ** 2) ** 0.5 * width / (x1 - x2)
    height = l.abs * 2
    k = (y2 - y1) / (x2 - x1) #y=kx+b
    b = y1 - k * x1
    if l > 0
      for tx in x2.to_i..x1.to_i
        ty = tx * k + b
        fill_rect(tx, ty - l, 1, height, color)
      end
    else
      for tx in x1.to_i..x2.to_i
        ty = tx * k + b
        fill_rect(tx, ty + l, 1, height, color)
      end
    end
  end
end

# ============================================================================= 
# 新增类
# ============================================================================= 

class Bounds
  attr_accessor :minX
  attr_accessor :minX_all
  attr_accessor :minY
  attr_accessor :minY_all
  attr_accessor :maxX
  attr_accessor :maxX_all
  attr_accessor :maxY
  attr_accessor :maxY_all

  def self.Get_inner(_minX, _minY, _maxX, _maxY, _minX_all = _minX, _minY_all = _minY, _maxX_all = _maxX, _maxY_all = _maxY)
    bounds = Bounds.new
    bounds.minX = _minX
    bounds.minY = _minY
    bounds.maxX = _maxX
    bounds.maxY = _maxY
    bounds.minX_all = _minX_all
    bounds.minY_all = _minY_all
    bounds.maxX_all = _maxX_all
    bounds.maxY_all = _maxY_all
    return bounds
  end

  def self.Get(object)
    return Get_inner(0, 0, 0, 0) if !object

    if object.class.name.include?("Sprite_Character")
      return Get_inner(object.x - object.width / 2, object.y - object.height, object.x + object.width / 2, object.y)
    elsif object.class.name.include?("Sprite")
      sprite_xoffset = object.ox - object.x
      sprite_yoffset = object.oy - object.y
      return Get_inner(object.x - sprite_xoffset, object.y - sprite_yoffset, object.x - sprite_xoffset + object.width, object.y - sprite_yoffset + object.height)
    elsif object.class.name.include?("Window")
      viewport_rect_x = 0
      viewport_rect_y = 0
      if object.viewport
        viewport_rect_x = object.viewport.rect.x
        viewport_rect_y = object.viewport.rect.y
      end
      return Get_inner(object.x + viewport_rect_x, object.y + viewport_rect_y, object.x + viewport_rect_x + object.width, object.y + viewport_rect_y + object.height)
    elsif object.class.name.include?("DebugReflector_TextInfo")
      return Get_inner(object.x, object.y, object.x + object.width, object.y + object.height, object.x_all, object.y_all, object.x_all + object.width_all, object.y_all + object.height_all)
    elsif object.class.name.include?("DebugReflector_ImgInfo")
      return Get_inner(object.x, object.y, object.x + object.width, object.y + object.height)
    else
      return Get_inner(object.x, object.y, object.x + object.width, object.y + object.height)
    end
  end

  # 限制bounds不要超出可见范围
  def limit()
    @minX = [@minX, 0].max;
    @minY = [@minY, 0].max;
    @maxX = [@maxX, $debug_reflector_Graphics_width].min;
    @maxY = [@maxY, $debug_reflector_Graphics_height].min;  
    @minX_all = [@minX_all, 0].max;
    @minY_all = [@minY_all, 0].max;
    @maxX_all = [@maxX_all, $debug_reflector_Graphics_width].min;
    @maxY_all = [@maxY_all, $debug_reflector_Graphics_height].min;
  end
end

# ============================================================================= 
# 函数 Module
# ============================================================================= 

# 交互逻辑用
$DebugReflector_HoverObject = nil
$DebugReflector_ClickObject = nil

# 公共函数类库
module DebugUtils
  # 交互逻辑用
  @DebugReflector_LastClickTime = 0;

  # 优先级
  @DebugReflector_Priority = Hash[
    # 其他
    "DebugReflector_TextInfo" => 5,
    "DebugReflector_ImgInfo" => 5,
    # Window
    "Window" => 4,
    # Sprite
    "Sprite_Picture" => 3,
    "Sprite_Character" => 2,
    "Sprite_Battler" => 2,
    "Spriteset" => 0,
    # 必须放在最后，否则到他就不再继续往后搜索了
    "Sprite" => 1
  ]

  module_function
  # 判断点击对象的优先级，越大优先级越高
  def get_priority(object)
    return -99 if !object

    @DebugReflector_Priority.each do |key, value|
      if object.class.name.include?(key)
        return value
      end
    end

    return -99;
  end

  # 清除已经绘制的提示
  def clear_click_graphics
    $debug_reflector_click_graphics.clear
  end

  # 清除已经绘制的提示
  def clear_hover_graphics
    $debug_reflector_hover_graphics.clear
  end

  # 为对象绘制提示
  def draw_click_lines(object, offset, color)
    click_bounds = Bounds.Get(object)
    click_bounds.limit
    click_bounds.minX += offset
    click_bounds.minY += offset
    click_bounds.maxX -= offset
    click_bounds.maxY -= offset

    thickness = 3
    clear_click_graphics

    $debug_reflector_click_graphics.drawline(click_bounds.minX_all, click_bounds.minY_all, click_bounds.maxX_all, click_bounds.minY_all, thickness, $debug_reflector_hover_color_all)
    $debug_reflector_click_graphics.drawline(click_bounds.maxX_all, click_bounds.minY_all, click_bounds.maxX_all, click_bounds.maxY_all, thickness, $debug_reflector_hover_color_all)
    $debug_reflector_click_graphics.drawline(click_bounds.maxX_all, click_bounds.maxY_all, click_bounds.minX_all, click_bounds.maxY_all, thickness, $debug_reflector_hover_color_all)
    $debug_reflector_click_graphics.drawline(click_bounds.minX_all, click_bounds.maxY_all, click_bounds.minX_all, click_bounds.minY_all, thickness, $debug_reflector_hover_color_all)

    $debug_reflector_click_graphics.drawline(click_bounds.minX, click_bounds.minY, click_bounds.maxX, click_bounds.minY, thickness, color)
    $debug_reflector_click_graphics.drawline(click_bounds.maxX, click_bounds.minY, click_bounds.maxX, click_bounds.maxY, thickness, color)
    $debug_reflector_click_graphics.drawline(click_bounds.maxX, click_bounds.maxY, click_bounds.minX, click_bounds.maxY, thickness, color)
    $debug_reflector_click_graphics.drawline(click_bounds.minX, click_bounds.maxY, click_bounds.minX, click_bounds.minY, thickness, color)
  end

  # 为对象绘制提示
  def draw_hover_lines(object, offset, color)
    hover_bounds = Bounds.Get(object)
    hover_bounds.limit
    hover_bounds.minX += offset
    hover_bounds.minY += offset
    hover_bounds.maxX -= offset
    hover_bounds.maxY -= offset

    thickness = 2
    clear_hover_graphics

    $debug_reflector_hover_graphics.drawline(hover_bounds.minX_all, hover_bounds.minY_all, hover_bounds.maxX_all, hover_bounds.minY_all, thickness, $debug_reflector_hover_color_all)
    $debug_reflector_hover_graphics.drawline(hover_bounds.maxX_all, hover_bounds.minY_all, hover_bounds.maxX_all, hover_bounds.maxY_all, thickness, $debug_reflector_hover_color_all)
    $debug_reflector_hover_graphics.drawline(hover_bounds.maxX_all, hover_bounds.maxY_all, hover_bounds.minX_all, hover_bounds.maxY_all, thickness, $debug_reflector_hover_color_all)
    $debug_reflector_hover_graphics.drawline(hover_bounds.minX_all, hover_bounds.maxY_all, hover_bounds.minX_all, hover_bounds.minY_all, thickness, $debug_reflector_hover_color_all)

    $debug_reflector_hover_graphics.drawline(hover_bounds.minX, hover_bounds.minY, hover_bounds.maxX, hover_bounds.minY, thickness, color)
    $debug_reflector_hover_graphics.drawline(hover_bounds.maxX, hover_bounds.minY, hover_bounds.maxX, hover_bounds.maxY, thickness, color)
    $debug_reflector_hover_graphics.drawline(hover_bounds.maxX, hover_bounds.maxY, hover_bounds.minX, hover_bounds.maxY, thickness, color)
    $debug_reflector_hover_graphics.drawline(hover_bounds.minX, hover_bounds.maxY, hover_bounds.minX, hover_bounds.minY, thickness, color)
  end

  # 按下开启调试反射器
  def is_debug_reflector_enabled()
    if $debug_reflector_rm_version == "VA"
      return Input.press?(:F6)
    else
      return Input.press?(Input::F6)
    end
  end

  # 离开调试时的处理
  def exit_hover(object)
    if !object || $DebugReflector_HoverObject == object
        $DebugReflector_HoverObject = nil;
        clear_hover_graphics
    end
  end

  # 离开调试时的处理
  def exit_click(object)
    if !object || $DebugReflector_ClickObject == object
        $DebugReflector_ClickObject = nil;
        clear_click_graphics
    end
  end

  # 
  def if_child(child, parent)
    return child.debug_reflector_parent == parent
  end

  # 对对象进行监控
  def do_debug_check(object, offset)
    return if !object
    if DebugMouse.check_touched(object)
      check = true
      # 决定本轮选择会选中谁
      if $DebugReflector_HoverObject
        priority = get_priority(object)
        # 特殊标记的不被选择
        if priority == -100
          check = false
        else
          last_bounds = Bounds.Get($DebugReflector_HoverObject)
          last_bounds.limit
          cur_bounds = Bounds.Get(object)
          cur_bounds.limit
          # 检查是否将对方完全覆盖
          if cur_bounds.minX <= last_bounds.minX && cur_bounds.minY <= last_bounds.minY && cur_bounds.maxX >= last_bounds.maxX && cur_bounds.maxY >= last_bounds.maxY
            # 将对方完全包围
            check = false
          else
            # 检查优先级
            last_priority = get_priority($DebugReflector_HoverObject)
            # 优先级高
            if priority > last_priority
              # 但是对方是自己的child
              if if_child($DebugReflector_HoverObject, object)
                check = false
              end
            else # 优先级低或相等
              # 自己不是对方的child
              if !if_child(object, $DebugReflector_HoverObject)
                # 检查是否被对方完全覆盖
                if last_bounds.minX > cur_bounds.minX || last_bounds.minY > cur_bounds.minY || last_bounds.maxX < cur_bounds.maxX || last_bounds.maxY < cur_bounds.maxY
                  # 没有被对方完全包围
                  check = false
                end
              end
            end
          end
        end
      end

      # 触发选择
      if check
        $DebugReflector_HoverObject = object
        # 如果不是已经点选，则可以画线
        if $DebugReflector_ClickObject != object
          draw_hover_lines(object, offset, $debug_reflector_hover_color)
        else # 已经点选了，清除线条
          clear_hover_graphics
        end
      end

      if DebugMouse.click
        # 点选当前hover的对象
        if $DebugReflector_HoverObject == object
          click_time = Time.now.to_f;
          # 避免过短时间内的反复触发
          if click_time - @DebugReflector_LastClickTime > 0.3
            @DebugReflector_LastClickTime = click_time

            $DebugReflector_ClickObject = $DebugReflector_HoverObject
            draw_click_lines($DebugReflector_ClickObject, offset, $debug_reflector_click_color)

            puts $DebugReflector_ClickObject.inspect
            puts " "
            puts $DebugReflector_ClickObject.debug_reflector_stack
            puts "# ======================================="

            if $debug_reflector_rm_version != "VA" && defined? DebugMessage
              DebugMessage.Log($DebugReflector_ClickObject.inspect)
              DebugMessage.Log(" ")
              DebugMessage.Log($DebugReflector_ClickObject.debug_reflector_stack)
              DebugMessage.Log("# =======================================")
            end
          end
        end
      end
    else
      exit_hover(object)
    end
  end
end

# 窗口处理类库
module DebugWindow
  module_function
  # 获取窗口句柄
  def get_hWnd
    return @hwnd if @hwnd
    # 获取调用线程（RM 的主线程）的进程标识
    threadID = $DebugReflector_GetCurrentThreadId.call
    # 获取 Z 次序中最靠前的窗口
    hWnd = $DebugReflector_GetWindow.call($DebugReflector_GetForegroundWindow.call, 0)
    # 枚举所有窗口
    while hWnd != 0
      # 如果创建该窗口的线程标识匹配本线程标识
      if threadID == $DebugReflector_GetWindowThreadProcessId.call(hWnd, 0)
        # 分配一个 11 个字节的缓冲区
        className = " " * 11
        # 获取该窗口的类名
        $DebugReflector_GetClassName.call(hWnd, className, 12)
        # 如果匹配 RGSS Player 则跳出循环
        break if className == "RGSS Player"
      end
      # 获取下一个窗口
      hWnd = $DebugReflector_GetWindow.call(hWnd, 2)
    end
    @hwnd=hWnd
    return hWnd
  end
 
  def MAKELONG(wLow,wHigh)
    (wLow&0xFFFF)|((wHigh<<16)&0xFFFF0000)
  end
end

if $debug_reflector_rm_version != "XP"
  $debug_reflector_Graphics_height = Graphics.height
  $debug_reflector_Graphics_width = Graphics.width
else

end

# 绘制提示用
$debug_reflector_click_graphics = Bitmap.new($debug_reflector_Graphics_width, $debug_reflector_Graphics_height)
$debug_reflector_hover_graphics = Bitmap.new($debug_reflector_Graphics_width, $debug_reflector_Graphics_height)
$debug_reflector_mouse_graphics = Bitmap.new($debug_reflector_Graphics_width, $debug_reflector_Graphics_height)

# 鼠标点击事件用
$debug_reflector_mouse_left_clicked = false

# 鼠标处理类库
module DebugMouse
  module_function
  # 获取鼠标位置
  def mouse_pos
    pos = [0, 0].pack('ll')
    $DebugReflector_GetCursorPos.call(pos)
    return pos.unpack('ll') 
  end

  #判断鼠标指针是否在客户区
  def cursor_in_client
    x,y = mouse_pos
    hr = $DebugReflector_SendMessage.call(DebugWindow.get_hWnd, 0x0084, 0, DebugWindow.MAKELONG(x,y)) #WM_NCHITTEST  HTCLIENT
    return hr == 1 && hr != 0 && $DebugReflector_GetForegroundWindow.call == DebugWindow.get_hWnd 
  end

  # 获取鼠标在窗口内的位置
  def mouse_pos_in_window
    x,y = mouse_pos

    window_rect = "\0" * 16
    $DebugReflector_GetWindowRect.call(DebugWindow.get_hWnd, window_rect)
    client_rect = "\0" * 16
    $DebugReflector_GetClientRect.call(DebugWindow.get_hWnd, client_rect)

    wl, wt, wr, wb = window_rect.unpack('llll')
    cl, ct, cr, cb = client_rect.unpack('llll')
    return x - wl, y - wt - (wb - wt - cb)
  end

  # 检查鼠标是否在对象范围内
  def check_touched(object)
    if cursor_in_client
      x,y = mouse_pos_in_window
      check_bounds = Bounds.Get(object)
      check_bounds.limit
      return (check_bounds.minX <= x && check_bounds.maxX >= x && check_bounds.minY <= y && check_bounds.maxY >= y)
    end
    return false
  end

  # 判断是否按下鼠标左键
  def click()
    return $debug_reflector_mouse_left_clicked
  end
end

# ============================================================================= //
# 文本和图案信息
# ============================================================================= //

# 记录drawText信息
class DebugReflector_TextInfo
  attr_accessor :text
  attr_accessor :ox
  attr_accessor :oy
  attr_accessor :maxWidth
  attr_accessor :lineHeight
  attr_accessor :align

  attr_accessor :x
  attr_accessor :y
  attr_accessor :width
  attr_accessor :height
  attr_accessor :x_all
  attr_accessor :y_all
  attr_accessor :width_all
  attr_accessor :height_all

  attr_accessor :debug_reflector_stack

  def initialize(bitmap, text, x, y, maxWidth, lineHeight, align)
    @text = text
    @ox = x
    @oy = y
    @maxWidth = maxWidth
    @lineHeight = lineHeight
    @align = align

    @bitmap = bitmap
    @x = 0
    @y = 0
    @width = 0
    @height = 0
    @debug_reflector_stack = caller.inspect

    calculate_bounds
  end

  def calculate_bounds
    if @bitmap && @bitmap.outer
      padding = @bitmap.outer.padding

      outer_bounds = Bounds.Get(@bitmap.outer)
      outer_bounds.limit

      # 文本实际占用的宽度
      text_rect = @bitmap.text_size(@text);
      text_width = text_rect.width
      text_height = text_rect.height
      # 文本最大占用宽度
      max_width = @maxWidth
      # lineHeight是行间距
      line_height = @lineHeight
      # 字体大小
      font_size = @bitmap.font.size

      @x = ((@align == 1) ? @ox + max_width / 2 - text_width / 2 : ((@align == 2) ? @ox + max_width - text_width : @ox)) + outer_bounds.minX + padding
      @width = text_width

      @x_all = @ox + outer_bounds.minX + padding
      @width_all = max_width
     
      @y = @oy + outer_bounds.minY + padding
      if $debug_reflector_rm_version == "VA"
        @height = text_height
      elsif $debug_reflector_rm_version == "VX"
        @height = text_height + 4
      end

      @y_all = @oy + outer_bounds.minY + padding
      @height_all = line_height

    end
  end

  def update
    calculate_bounds

    if DebugUtils.is_debug_reflector_enabled
        if can_debug_reflector_select
            DebugUtils.do_debug_check(self, 0);
        else
            DebugUtils.exit_hover(self);
            DebugUtils.exit_click(self);
        end
    else
        DebugUtils.exit_hover(self);
    end
  end

  def can_debug_reflector_select
    if @bitmap && @bitmap.outer
        return @bitmap.outer.can_debug_reflector_select
    end
    return true
  end

  def debug_reflector_parent
    return nil if !@bitmap
    return @bitmap.outer
  end
end

# 记录blt信息
class DebugReflector_ImgInfo
  attr_accessor :source
  attr_accessor :dx
  attr_accessor :dy
  attr_accessor :dw
  attr_accessor :dh

  attr_accessor :x
  attr_accessor :y
  attr_accessor :width
  attr_accessor :height
  attr_accessor :debug_reflector_stack

  def initialize(bitmap, source, sx, sy, sw, sh, dx, dy, dw, dh)
    @source = source
    @sx = sx
    @sy = sy
    @sw = sw
    @sh = sh
    @dx = dx
    @dy = dy
    @dw = dw
    @dh = dh

    @bitmap = bitmap
    @x = 0
    @y = 0
    @width = 0
    @height = 0
    @debug_reflector_stack = caller.inspect

    calculate_bounds
  end

  def set(dx, dy, dw, dh)
    @dx = dx
    @dy = dy
    @dw = dw
    @dh = dh

    calculate_bounds
  end

  def calculate_bounds
    if @bitmap && @bitmap.outer
      padding = @bitmap.outer.padding

      outer_bounds = Bounds.Get(@bitmap.outer)
      outer_bounds.limit

      @x = @dx + outer_bounds.minX + padding
      @y = @dy + outer_bounds.minY + padding
      @width = @dw
      @height = @dh
    end
  end

  def update
    calculate_bounds

    if DebugUtils.is_debug_reflector_enabled
        if can_debug_reflector_select
            DebugUtils.do_debug_check(self, 0);
        else
            DebugUtils.exit_hover(self);
            DebugUtils.exit_click(self);
        end
    else
        DebugUtils.exit_hover(self);
    end
  end

  def can_debug_reflector_select
    if @bitmap && @bitmap.outer
        return @bitmap.outer.can_debug_reflector_select
    end
    return true
  end

  def debug_reflector_parent
    return nil if !@bitmap
    return @bitmap.outer
  end
end

# ============================================================================= //
# 添加监控
# ============================================================================= //

class Sprite
  attr_accessor :debug_reflector_parent
  attr_accessor :debug_reflector_stack

  alias debug_reflector_origin_initialize initialize
  def initialize(viewport = nil)
    debug_reflector_origin_initialize(viewport)
    # 非active下不执行
    return if !$debug_reflector_active

    @debug_reflector_parent = nil
    @debug_reflector_stack = caller.inspect

    if self.bitmap
        self.bitmap.set_outer(self)
    end
  end

  alias debug_reflector_origin_update update
  def update
    debug_reflector_origin_update
    # 非active下不执行
    return if !$debug_reflector_active

    return if $click_graphics_sprite == self ||$hover_graphics_sprite == self
    if DebugUtils.is_debug_reflector_enabled
        if can_debug_reflector_select
            DebugUtils.do_debug_check(self, 0);
        else
            DebugUtils.exit_hover(self);
            DebugUtils.exit_click(self);
        end
    else
        DebugUtils.exit_hover(self);
    end

    if self.bitmap
      self.bitmap.update
    end
  end

  def can_debug_reflector_select
    if !self.visible
      return false
    end

    if @debug_reflector_parent
        return @debug_reflector_parent.can_debug_reflector_select
    end

    return true
  end

  def padding
    return 0
  end
end

class Window_Base
  attr_accessor :debug_reflector_parent
  attr_accessor :debug_reflector_stack

  alias debug_reflector_origin_initialize initialize
  def initialize(x, y, width, height)
    debug_reflector_origin_initialize(x, y, width, height)
    # 非active下不执行
    return if !$debug_reflector_active

    @debug_reflector_parent = nil
    @debug_reflector_stack = caller.inspect

    if $debug_reflector_rm_version == "VX"
      if self.contents
        self.contents.set_outer(self)
      end
    end
  end

  alias debug_reflector_origin_update update
  def update
    debug_reflector_origin_update
    # 非active下不执行
    return if !$debug_reflector_active

    if DebugUtils.is_debug_reflector_enabled
        if can_debug_reflector_select
            DebugUtils.do_debug_check(self, 0);
        else
            DebugUtils.exit_hover(self);
            DebugUtils.exit_click(self);
        end
    else
        DebugUtils.exit_hover(self);
    end

    if self.contents
      self.contents.update()
    end
  end

  def can_debug_reflector_select
    open = true
    if $debug_reflector_rm_version == "VA"
      open = open?
    elsif $debug_reflector_rm_version == "VX"
      open = (self.openness == 255)
    end
    if !open || !self.visible
      return false
    end

    if @debug_reflector_parent
        return @debug_reflector_parent.can_debug_reflector_select
    end

    return true
  end
end

if $debug_reflector_rm_version == "VA"
class Window_Base
  alias debug_reflector_origin_create_contents create_contents
  def create_contents
    debug_reflector_origin_create_contents

    if self.contents
      self.contents.set_outer(self)
    end
  end
end
elsif $debug_reflector_rm_version == "VX"
class Window_Base
  def padding
    return 16
  end
end
else
end

if $debug_reflector_rm_version != "XP"
class Scene_Base
  alias debug_reflector_origin_main main
  def main
    debug_reflector_origin_main
    # 非active下不执行
    return if !$debug_reflector_active

    # 每次切换场景时清除
    $debug_reflector_click_graphics.clear
    $debug_reflector_hover_graphics.clear
  end

  alias debug_reflector_origin_post_start post_start
  def post_start
    debug_reflector_origin_post_start
    # 非active下不执行
    return if !$debug_reflector_active

    # 每次进入场景时初始化以保证sprite在最前层
    init_sprites
  end

  def init_sprites
    $debug_reflector_click_graphics.clear
    $debug_reflector_hover_graphics.clear

    $click_graphics_sprite = Sprite.new
    $click_graphics_sprite.z = 1000
    $click_graphics_sprite.bitmap = $debug_reflector_click_graphics
    $click_graphics_sprite.ox = $debug_reflector_click_graphics.width / 2
    $click_graphics_sprite.oy = $debug_reflector_click_graphics.height / 2
    $click_graphics_sprite.x = $debug_reflector_Graphics_width / 2
    $click_graphics_sprite.y = $debug_reflector_Graphics_height / 2

    $hover_graphics_sprite = Sprite.new
    $hover_graphics_sprite.z = 1000
    $hover_graphics_sprite.bitmap = $debug_reflector_hover_graphics
    $hover_graphics_sprite.ox = $debug_reflector_hover_graphics.width / 2
    $hover_graphics_sprite.oy = $debug_reflector_hover_graphics.height / 2
    $hover_graphics_sprite.x = $debug_reflector_Graphics_width / 2
    $hover_graphics_sprite.y = $debug_reflector_Graphics_height / 2

    $mouse_graphics_sprite = Sprite.new
    $mouse_graphics_sprite.z = 1000
    $mouse_graphics_sprite.bitmap = $debug_reflector_mouse_graphics
    $mouse_graphics_sprite.ox = $debug_reflector_mouse_graphics.width / 2
    $mouse_graphics_sprite.oy = $debug_reflector_mouse_graphics.height / 2
    $mouse_graphics_sprite.x = $debug_reflector_Graphics_width / 2
    $mouse_graphics_sprite.y = $debug_reflector_Graphics_height / 2
  end

  alias debug_reflector_origin_update update
  def update
    debug_reflector_origin_update
    # 非active下不执行
    return if !$debug_reflector_active

    # 按下W清除当前选择以处理偶尔系统选择卡死
    if ($debug_reflector_rm_version == "VA" && Input.press?(:R)) || ($debug_reflector_rm_version != "VA" && Input.press?(Input::R))
      DebugUtils.exit_hover(nil);
      DebugUtils.exit_click(nil);
    end

    # 实时绘制鼠标位置
    if $debug_reflector_show_mouse_pos
      if DebugMouse.cursor_in_client
        x,y = DebugMouse.mouse_pos_in_window

        mouse_hint = "(" + x.to_s + ", " + y.to_s + ")"
        text_rect = $debug_reflector_mouse_graphics.text_size(mouse_hint)

        minX = x + 15
        minX = 0 if minX < 0

        maxX = minX + text_rect.width
        if maxX > $debug_reflector_Graphics_width
          maxX = $debug_reflector_Graphics_width
          minX = maxX - text_rect.width
        end
            
        minY = y + 15
        minY = 0 if minY < 0

        maxY = minY + text_rect.height
        if maxY > $debug_reflector_Graphics_height
          maxY = $debug_reflector_Graphics_height
          minY = maxY - text_rect.height
        end

        $debug_reflector_mouse_graphics.clear
        $debug_reflector_mouse_graphics.draw_text(minX, minY, text_rect.width, text_rect.height, mouse_hint)
      end
    end
  end
end
else
end

# ============================================================================= //
# 鼠标监控
# ============================================================================= //
class << Graphics
  alias debug_reflector_origin_update update
  def update
    debug_reflector_origin_update
    # 非active下不执行
    return if !$debug_reflector_active

    # 时刻监听鼠标点击
    $debug_reflector_mouse_left_clicked = ($DebugReflector_GetAsyncKeyState.call(0x01) != 0)
  end
end