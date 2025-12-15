// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

#include "shared.hpp"

#include <TopoDS_Shape.hxx>

using namespace emscripten;

EMSCRIPTEN_BINDINGS(Shared)
{
    // 注册 JS/TypedArray 映射，便于在 embind 中传递底层数组
    register_type<Int8Array>("Int8Array");     // 8 位有符号整型数组
    register_type<Int16Array>("Int16Array");   // 16 位有符号整型数组
    register_type<Int32Array>("Int32Array");   // 32 位有符号整型数组
    register_type<Uint8Array>("Uint8Array");   // 8 位无符号整型数组
    register_type<Uint16Array>("Uint16Array"); // 16 位无符号整型数组
    register_type<Uint32Array>("Uint32Array"); // 32 位无符号整型数组
    register_type<Float32Array>("Float32Array"); // 32 位浮点数组
    register_type<Float64Array>("Float64Array"); // 64 位浮点数组
    register_type<BigInt64Array>("BigInt64Array"); // 64 位有符号大整数数组
    register_type<BigUint64Array>("BigUint64Array"); // 64 位无符号大整数数组

    // 注册自定义数组类型映射（便于传递 Vector3 / PointAndParameter 等数组）
    register_type<Vector3Array>("Array<Vector3>");                   // Vector3 数组类型
    register_type<PointAndParameterArray>("Array<PointAndParameter>"); // PointAndParameter 数组类型

    // 注册通用/拓扑相关数组类型（方便在 JS 层使用 Array<T>）
    register_type<NumberArray>("Array<number>");          // number 数组
    register_type<ShapeArray>("Array<TopoDS_Shape>");     // TopoDS_Shape 数组
    register_type<EdgeArray>("Array<TopoDS_Edge>");       // TopoDS_Edge 数组
    register_type<FaceArray>("Array<TopoDS_Face>");       // TopoDS_Face 数组
    register_type<WireArray>("Array<TopoDS_Wire>");       // TopoDS_Wire 数组
    register_type<ShellArray>("Array<TopoDS_Shell>");     // TopoDS_Shell 数组
    register_type<PntArray>("Array<gp_Pnt>");             // gp_Pnt（点）数组

    // 注册可选类型（std::optional<T> 在 embind 中的支持）
    register_optional<double>();                 // optional<double>
    register_optional<UV>();                     // optional<UV>
    register_optional<PointAndParameter>();      // optional<PointAndParameter>
    register_optional<ProjectPointResult>();     // optional<ProjectPointResult>
    register_optional<std::string>();            // optional<std::string>

    // 值对象绑定：Domain（表示参数区间 start/end）
    value_object<Domain>("Domain")
        .field("start", &Domain::start) // 起始参数
        .field("end", &Domain::end);    // 结束参数

    // 值对象绑定：UV（曲面参数对 u,v）
    value_object<UV>("UV")
        .field("u", &UV::u) // u 参数
        .field("v", &UV::v); // v 参数

    // 值对象绑定：Vector3（三维坐标 x,y,z）
    value_object<Vector3>("Vector3")
        .field("x", &Vector3::x) // x 坐标
        .field("y", &Vector3::y) // y 坐标
        .field("z", &Vector3::z); // z 坐标

    // 值对象绑定：PointAndParameter（点 + 对应参数）
    value_object<PointAndParameter>("PointAndParameter")
        .field("point", &PointAndParameter::point)         // 三维点
        .field("parameter", &PointAndParameter::parameter); // 曲线/曲面参数

    // 值对象绑定：Ax1（轴，包含 location 与 direction）
    value_object<Ax1>("Ax1")
        .field("location", &Ax1::location)   // 轴上的位置（gp_Pnt）
        .field("direction", &Ax1::direction); // 轴方向（gp_Dir）

    // 值对象绑定：Ax2（笛卡尔坐标系 Ax2）
    value_object<Ax2>("Ax2")
        .field("location", &Ax2::location)     // 原点位置
        .field("direction", &Ax2::direction)   // 主方向
        .field("xDirection", &Ax2::xDirection); // x 方向

    // 值对象绑定：Ax3（三维参考系 Ax3）
    value_object<Ax3>("Ax3")
        .field("location", &Ax3::location)     // 参考系位置
        .field("direction", &Ax3::direction)   // 主方向
        .field("xDirection", &Ax3::xDirection); // x 方向

    // 值对象绑定：Pln（平面参数，包含位置与方向）
    value_object<Pln>("Pln")
        .field("location", &Pln::location)     // 平面位置（gp_Pnt）
        .field("direction", &Pln::direction)   // 平面法向/方向（gp_Dir）
        .field("xDirection", &Pln::xDirection); // 平面 x 方向

    // 注册 ExtremaCCResult 的可选类型（用于最近点计算可能为空的返回）
    register_optional<ExtremaCCResult>();

    // 值对象绑定：ProjectPointResult（点投影结果：点/距离/参数）
    value_object<ProjectPointResult>("ProjectPointResult")
        .field("point", &ProjectPointResult::point)       // 最近点坐标
        .field("distance", &ProjectPointResult::distance) // 点到曲面/曲线的距离
        .field("parameter", &ProjectPointResult::parameter); // 对应参数（如 u/v 或 t）

    // 值对象绑定：ExtremaCCResult（两曲线最近点结果）
    value_object<ExtremaCCResult>("ExtremaCCResult")
        .field("distance", &ExtremaCCResult::distance) // 最短距离
        .field("p1", &ExtremaCCResult::p1)             // 曲线1 上的点
        .field("p2", &ExtremaCCResult::p2)             // 曲线2 上的点
        .field("isParallel", &ExtremaCCResult::isParallel) // 是否平行标志
        .field("u1", &ExtremaCCResult::u1)             // 曲线1 参数
        .field("u2", &ExtremaCCResult::u2);            // 曲线2 参数
}