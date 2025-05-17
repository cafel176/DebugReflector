# DebugReflector

调试反射器插件

——***以创作者为本，让RM没有难做的演出***

<br/>

灵感来源于Unreal的控件反射器，这个东西调试UI是真方便，对于RM这种写UI甚至还不如Slate简单的情况下，把这个调试工具搬过来可以有效的协助<br/>
支持查看任意视图组件的范围，信息和创建堆栈；支持包括UI窗口，UI文本，UI图片，地图上的事件，玩家的角色等视觉组件，方便快速进行UI调试和获取地图内容<br/>
适用于RMMZ、RMMV、RMVA、RMVX，暂不支持RMXP<br/>

<br/>

QQ群：***792888538***   欢迎反馈遇到的问题和希望支持的功能

<br/>

MZ/MV 视频教程：https://www.bilibili.com/video/BV17MVZzgELW

<br/>

MZ/MV Project1：https://rpg.blue/forum.php?mod=viewthread&tid=497375#lastpost

<br/>

VA/VX 视频教程：https://www.bilibili.com/video/BV1qKVZzrEWW

<br/>

VA/VX Project1：https://rpg.blue/thread-497376-1-1.html

<br/>

> [!IMPORTANT] 
> 注意：本工具完全用于开发调试，开发完成后进入部署阶段时，请将插件关闭避免影响到游戏流程<br/>

<br/>

## 可参考使用案例：
老师们的作品都很棒，欢迎大家关注！

<br/>

RMMZ：通过直接查看文本位置和追溯堆栈排查多插件环境下适配阿拉伯语时出现的文本位置混乱<br/>
测试工程来源：BLACK BOX LSS  作者：Fif老师<br/>
欢迎大家关注：https://afdian.com/a/blackboxFiF
   
![案例1](https://github.com/cafel176/DebugReflector/blob/main/example1.png?raw=true '案例1')

<br/>

RMMV：通过直接查看菜单项位置和范围排查纯图片菜单下鼠标点击位置检测不准的问题<br/>
测试工程来源：Heart Knots 心结之种  作者：星羽樱老师<br/>
欢迎大家关注：https://store.steampowered.com/app/2553270/__Heart_Knots/

![案例1](https://github.com/cafel176/DebugReflector/blob/main/example2.png?raw=true '案例1')

<br/>

MV之前的版本暂未找到实际使用环境的测试合作者<br/>
本人热衷于解决各种RM插件冲突，事件疑难杂症等，以为做各种RM调试插件积累实际使用案例，欢迎有需要的老师和我联系<br/>

<br/>

## 插件功能：

1. 按住***F6***可以选择查看任意视图组件的实际尺寸，包括UI窗口，UI文本，UI图片，地图上的事件，玩家的角色等，鼠标移动到其范围内即可出现黄色提示框，便于检查视觉效果
   * 文本会额外显示蓝色提示框以表示文本最大宽度的范围
   * 有时出现按住 ***F6*** 也不显示提示框的情况，可以按下 ***ESC*** (VA/VX是***W***) 将之重置即可
   
![范围查看](https://github.com/cafel176/DebugReflector/blob/main/pic1.png?raw=true '范围查看')
![范围查看](https://github.com/cafel176/DebugReflector/blob/main/pic2.png?raw=true '范围查看')

<br/>

2. 显示黄色提示框时，鼠标点击它即可将之选中，提示框变为红色且不按***F6*** 时也不消失，同时会在控制台输出选中物体的信息以及其创建时的调用堆栈，方便查看它当前的状态以及是在哪里被谁创建出来的，便于组件溯源
   * 点选的物体会赋值给变量 ***DebugReflector_ClickObject***，可以通过脚本对其做任意处理，便于运行时调试
   
![信息查看](https://github.com/cafel176/DebugReflector/blob/main/pic3.png?raw=true '信息查看')
![信息查看](https://github.com/cafel176/DebugReflector/blob/main/pic4.png?raw=true '信息查看')

<br/>

3. 多个Sprite彼此重叠，范围相同的情况，想要选中特定的某个，可以按下 ***F7*** 使用限制器 (VA/VX暂不支持此功能)
   * 在限制器窗口输入Sprite当前显示图片的图片名即可，如果输入空则表示无限制
 
![图片限制](https://github.com/cafel176/DebugReflector/blob/main/pic5.png?raw=true '图片限制')

4. 可以实时显示鼠标在游戏窗口内的坐标，通过参数开关控制，便于直接测量像素距离而无需盲试

![坐标查看](https://github.com/cafel176/DebugReflector/blob/main/pic6.png?raw=true '坐标查看')

<br/>