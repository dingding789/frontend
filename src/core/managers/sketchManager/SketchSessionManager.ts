import * as THREE from 'three';
import { SketchTool} from './SketchManager';
import { ref } from 'vue';
import { bindEvents,bindMouseMove,bindCancelContinuous } from '../eventManager/sketchsEvent';
import { RectPreviewItem } from '../../geometry/sketchs/RectPreviewItem';
import { Rect3PreviewItem } from '../../geometry/sketchs/Rect3PreviewItem';

/**
 * SketchSessionManager
 * 管理草图绘制会话状态，包括：
 * - 当前是否处于绘图状态
 * - 当前选中工具
 * - 当前选中绘图平面
 * - 鼠标拾取与事件绑定
 * - 矩形/圆形绘制模式
 *
 * 主要方法：
 * - setTool: 设置当前绘图工具并重置预览对象
 * - setRectMode: 设置矩形绘制模式
 * - setCircleMode: 设置圆形绘制模式
 *
 * 构造函数会注册预览构造器并绑定事件
 */
export class SketchSessionManager {
    // ---------------- 会话状态 ----------------
    public isSketching = ref(false);           // 当前是否处于绘图状态
    public mouse = new THREE.Vector2();        // 鼠标屏幕坐标（-1~1）
    public raycaster = new THREE.Raycaster();  // 射线拾取器
    public currentSketchPlane: THREE.Plane | null = null; // 当前绘图平面
    public currentTool: SketchTool | null = null;         // 当前选中工具
    // 矩形绘制模式：'two-point' | 'three-point'，提供默认值以避免未声明属性错误
    public rectMode: 'two-point' | 'three-point' = 'two-point';
    // 圆形绘制模式：'two-point' | 'three-point'，提供默认值以避免未声明属性错误
    public circleMode: 'two-point' | 'three-point' = 'two-point';
    // 圆弧绘制模式：'threePoints' | 'centerStartEnd'，提供默认值以避免未声明属性错误
    public arcMode: 'threePoints' | 'centerStartEnd' = 'threePoints';
    // 样条绘制模式：'passPoint' | 'dependencePoint'，提供默认值以避免未声明属性错误
    public SpineCurveMode: 'passPoint' | 'dependencePoint' = 'passPoint';

    /**
     * 构造函数
     * 注册预览构造器，并绑定鼠标事件
     */
    constructor(private app: any, private manager: any) {
        this.manager.RectPreviewItem = RectPreviewItem;
        this.manager.Rect3PreviewItem = Rect3PreviewItem;
        bindEvents(this.app, this.manager, this);
        bindMouseMove(this.app, this.manager, this);
        bindCancelContinuous(this.app, this.manager, this);
    }

    /**
     * 设置当前绘图工具
     * @param tool 工具类型（point/line/arc/rect/circle）
     */
    setTool(tool: SketchTool) {
        this.currentTool = tool;
        this.manager.previewItem = null; // 重置预览对象
    }

    /** 设置矩形模式（暂存用户选择，供后续绘制逻辑使用） */
    setRectMode(mode: 'two-point' | 'three-point') {
        this.rectMode = mode;
    }

    /** 设置圆形模式（暂存用户选择，供后续绘制逻辑使用） */
    setCircleMode(mode: 'two-point' | 'three-point') {
        this.circleMode = mode;
    }
    /** 设置圆弧模式（暂存用户选择，供后续绘制逻辑使用） */
    setArcMode(mode: 'threePoints' | 'centerStartEnd') {
    this.arcMode = mode;
   } 
   // 设置样条模式（暂存用户选择，供后续绘制逻辑使用）
   setSplineMode(mode: 'passPoint' | 'dependencePoint') {
    this.SpineCurveMode = mode;
   }

}
