// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { GeometryType, IGeometry, Matrix4 } from "../../chili-core"; // 从核心库引入几何类型枚举、几何接口与矩阵类型
import { Geom_Geometry, Handle_Geom_Geometry } from "../lib/chili-wasm"; // 引入 OCCT 几何与其句柄类型（通过 embind 导出）
import { OcctHelper } from "./helper"; // 引入辅助工具，用于类型转换（如 Matrix4 到 OCCT 矩阵）

export abstract class OccGeometry implements IGeometry { // 定义 OCCT 几何的抽象基类，符合 IGeometry 接口
    private readonly _geometryType: GeometryType; // 缓存几何类型（曲线/曲面）
    private readonly _handleGeometry: Handle_Geom_Geometry; // 持有 OCCT 几何的句柄以管理生命周期

    get geometryType(): GeometryType { // 公共只读访问器：获取几何类型
        return this._geometryType; // 返回在构造时确定的几何类型
    }

    constructor(readonly geometry: Geom_Geometry) { // 构造函数，接收底层 OCCT 几何对象
        this._handleGeometry = new wasm.Handle_Geom_Geometry(geometry); // 用 embind 的 Handle 包装几何，管理引用计数/释放
        this._geometryType = this.getGeometryType(geometry); // 通过 RTTI 判断几何类型并缓存
    }

    private getGeometryType(geometry: Geom_Geometry) { // 内部方法：根据 OCCT 类型系统判断几何类型
        let isKind = (type: string) => wasm.Transient.isKind(geometry, type); // 使用 Transient.isKind 做运行时类型判断（支持派生类）

        if (isKind("Geom_Curve")) { // 若是 Geom_Curve 或其子类
            return GeometryType.Curve; // 标记为曲线类型
        } else if (isKind("Geom_Surface")) { // 若是 Geom_Surface 或其子类
            return GeometryType.Surface; // 标记为曲面类型
        }

        throw new Error("Unknown geometry type"); // 未识别的类型则抛错，提示上层处理
    }

    #disposed = false; // 私有字段：记录是否已释放，防止重复释放
    dispose = () => { // 对外释放方法（箭头函数以绑定 this）
        if (!this.#disposed) { // 仅在未释放时执行
            this.#disposed = true; // 标记为已释放
            this.disposeInternal(); // 调用内部释放逻辑
        }
    };

    protected disposeInternal() { // 受保护的释放实现，供子类扩展
        this._handleGeometry.delete(); // 删除 embind 句柄，释放 WASM/OCCT 侧资源
    }

    transform(value: Matrix4) { // 应用仿射变换到当前几何
        this.geometry.transform(OcctHelper.convertFromMatrix(value)); // 将 Matrix4 转为 OCCT 变换并调用底层 transform
    }

    abstract copy(): IGeometry; // 抽象：返回几何的深拷贝实例
    abstract transformed(matrix: Matrix4): IGeometry; // 抽象：返回应用变换后的新几何（不修改原对象）
}
