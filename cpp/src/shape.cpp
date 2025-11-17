// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

#include <emscripten/bind.h>
#include <emscripten/val.h>

#include <BRepAdaptor_Curve.hxx>
#include <BRepAlgoAPI_Defeaturing.hxx>
#include <BRepAlgoAPI_Section.hxx>
#include <BRepAlgoAPI_Splitter.hxx>
#include <BRepBuilderAPI_Copy.hxx>
#include <BRepBuilderAPI_MakeEdge.hxx>
#include <BRepBuilderAPI_MakeFace.hxx>
#include <BRepBuilderAPI_Sewing.hxx>
#include <BRepExtrema_ExtCC.hxx>
#include <BRepGProp.hxx>
#include <BRepGProp_Face.hxx>
#include <BRepOffsetAPI_MakeOffset.hxx>
#include <BRepPrim_Builder.hxx>
#include <BRepTools.hxx>
#include <BRepTools_ReShape.hxx>
#include <BRepTools_WireExplorer.hxx>
#include <BRep_Builder.hxx>
#include <BRep_Tool.hxx>
#include <GCPnts_AbscissaPoint.hxx>
#include <GProp_GProps.hxx>
#include <GeomAbs_JoinType.hxx>
#include <Geom_OffsetCurve.hxx>
#include <Geom_TrimmedCurve.hxx>
#include <HLRAlgo_Projector.hxx>
#include <HLRBRep_Algo.hxx>
#include <HLRBRep_HLRToShape.hxx>
#include <ShapeAnalysis.hxx>
#include <ShapeFix_Shape.hxx>
#include <TopExp.hxx>
#include <TopExp_Explorer.hxx>
#include <TopTools_IndexedDataMapOfShapeListOfShape.hxx>
#include <TopoDS.hxx>
#include <TopoDS_CompSolid.hxx>
#include <TopoDS_Compound.hxx>
#include <TopoDS_Edge.hxx>
#include <TopoDS_Face.hxx>
#include <TopoDS_Iterator.hxx>
#include <TopoDS_Shape.hxx>
#include <TopoDS_Shell.hxx>
#include <TopoDS_Solid.hxx>
#include <TopoDS_Vertex.hxx>
#include <TopoDS_Wire.hxx>
#include <gp_Ax3.hxx>
#include <gp_Dir.hxx>
#include <gp_Pnt.hxx>

#include "shared.hpp"
#include "utils.hpp"

using namespace emscripten;

class Shape {
public:
    static TopoDS_Shape clone(const TopoDS_Shape& shape)
    {
        BRepBuilderAPI_Copy copy(shape);
        return copy.Shape();
    }

    static bool isClosed(const TopoDS_Shape& shape)
    {
        return BRep_Tool::IsClosed(shape);
    }

    static ShapeArray findAncestor(const TopoDS_Shape& from, const TopoDS_Shape& subShape,
        const TopAbs_ShapeEnum& ancestorType)
    {
        TopTools_IndexedDataMapOfShapeListOfShape map;
        TopExp::MapShapesAndAncestors(from, subShape.ShapeType(), ancestorType, map);
        auto index = map.FindIndex(subShape);
        auto shapes = map.FindFromIndex(index);

        return ShapeArray(val::array(shapes.begin(), shapes.end()));
    }

    static ShapeArray findSubShapes(const TopoDS_Shape& shape, const TopAbs_ShapeEnum& shapeType)
    {
        TopTools_IndexedMapOfShape indexShape;
        TopExp::MapShapes(shape, shapeType, indexShape);

        return ShapeArray(val::array(indexShape.cbegin(), indexShape.cend()));
    }

    static ShapeArray iterShape(const TopoDS_Shape& shape)
    {
        val new_array = val::array();
        for (TopoDS_Iterator iter(shape); iter.More(); iter.Next()) {
            new_array.call<void>("push", iter.Value());
        }
        return ShapeArray(new_array);
    }

    static TopoDS_Shape sectionSS(const TopoDS_Shape& shape, const TopoDS_Shape& otherShape)
    {
        BRepAlgoAPI_Section section(shape, otherShape);
        return section.Shape();
    }

    static TopoDS_Shape sectionSP(const TopoDS_Shape& shape, const Pln& ax3)
    {
        gp_Pln pln = Pln::toPln(ax3);
        BRepAlgoAPI_Section section(shape, pln);
        return section.Shape();
    }

    static TopoDS_Shape splitShapes(const ShapeArray& arguments, const ShapeArray& tools)
    {
        TopTools_ListOfShape argumentsList = shapeArrayToListOfShape(arguments);
        TopTools_ListOfShape toolsList = shapeArrayToListOfShape(tools);
        BRepAlgoAPI_Splitter splitter;
        splitter.SetToFillHistory(false);
        splitter.SetArguments(argumentsList);
        splitter.SetTools(toolsList);
        splitter.SimplifyResult();
        splitter.Build();

        return splitter.Shape();
    }

    static TopoDS_Shape removeFeature(const TopoDS_Shape& shape, const ShapeArray& faces)
    {
        std::vector<TopoDS_Shape> facesVector = vecFromJSArray<TopoDS_Shape>(faces);
        BRepAlgoAPI_Defeaturing defea;
        defea.SetShape(shape);
        for (auto& face : facesVector) {
            defea.AddFaceToRemove(face);
        }
        defea.SetRunParallel(true);
        defea.Build();
        return defea.Shape();
    }

    static TopoDS_Compound shapeWires(const TopoDS_Shape& shape)
    {
        BRep_Builder builder;
        TopoDS_Compound compound;
        builder.MakeCompound(compound);

        TopExp_Explorer explorer;
        for (explorer.Init(shape, TopAbs_WIRE); explorer.More(); explorer.Next()) {
            builder.Add(compound, TopoDS::Wire(explorer.Current()));
        }

        return compound;
    }

    static size_t countShape(const TopoDS_Shape& shape, TopAbs_ShapeEnum shapeType)
    {
        size_t size = 0;
        TopExp_Explorer explorer;
        for (explorer.Init(shape, shapeType); explorer.More(); explorer.Next()) {
            size += 1;
        }
        return size;
    }

    static bool hasOnlyOneSub(const TopoDS_Shape& shape, TopAbs_ShapeEnum shapeType)
    {
        size_t size = 0;
        TopExp_Explorer explorer;
        for (explorer.Init(shape, shapeType); explorer.More(); explorer.Next()) {
            size += 1;
            if (size > 1) {
                return false;
            }
        }
        return size == 1;
    }

    static TopoDS_Shape removeSubShape(TopoDS_Shape& shape, const ShapeArray& subShapes)
    {
        std::vector<TopoDS_Shape> subShapesVector = vecFromJSArray<TopoDS_Shape>(subShapes);

        auto source = hasOnlyOneSub(shape, TopAbs_FACE) ? shapeWires(shape) : shape;
        TopTools_IndexedDataMapOfShapeListOfShape mapEF;
        TopExp::MapShapesAndAncestors(source, TopAbs_EDGE, TopAbs_FACE, mapEF);
        BRepTools_ReShape reShape;
        for (auto& subShape : subShapesVector) {
            reShape.Remove(subShape);

            TopTools_ListOfShape faces;
            if (mapEF.FindFromKey(subShape, faces)) {
                for (auto& face : faces) {
                    reShape.Remove(face);
                }
            }
        }

        ShapeFix_Shape fixer(reShape.Apply(source));
        fixer.Perform();

        return fixer.Shape();
    }

    static TopoDS_Shape replaceSubShape(const TopoDS_Shape& shape, const TopoDS_Shape& subShape,
        const TopoDS_Shape& newShape)
    {
        BRepTools_ReShape reShape;
        reShape.Replace(subShape, newShape);

        ShapeFix_Shape fixer(reShape.Apply(shape));
        fixer.Perform();

        return fixer.Shape();
    }

    static TopoDS_Shape sewing(const TopoDS_Shape& shape1, const TopoDS_Shape& shape2)
    {
        BRepBuilderAPI_Sewing sewing;
        sewing.Add(shape1);
        sewing.Add(shape2);

        sewing.Perform();
        return sewing.SewedShape();
    }

    static TopoDS_Shape hlr(const TopoDS_Shape& shape, const gp_Pnt& point, const gp_Dir& direction, const gp_Dir& xDirection)
    {
        gp_Ax3 ax3(point, direction, xDirection);
        gp_Trsf trsf;
        trsf.SetTransformation(ax3);

        HLRAlgo_Projector projector(trsf, false, false);
        Handle_HLRBRep_Algo algo = new HLRBRep_Algo();
        algo->Add(shape);
        algo->Projector(projector);
        algo->Update();

        HLRBRep_HLRToShape hlrToShape(algo);
        return hlrToShape.VCompound();
    }
};

class Vertex {
public:
    static Vector3 point(const TopoDS_Vertex& vertex)
    {
        return Vector3::fromPnt(BRep_Tool::Pnt(vertex));
    }
};

class Edge {
public:
    static TopoDS_Edge fromCurve(const Geom_Curve* curve)
    {
        Handle_Geom_Curve handleCurve(curve);
        BRepBuilderAPI_MakeEdge builder(handleCurve);
        return builder.Edge();
    }

    static double curveLength(const TopoDS_Edge& edge)
    {
        GProp_GProps props;
        BRepGProp::LinearProperties(edge, props);
        return props.Mass();
    }

    static Handle_Geom_TrimmedCurve curve(const TopoDS_Edge& edge)
    {
        double start(0.0), end(0.0);
        auto curve = BRep_Tool::Curve(edge, start, end);
        Handle_Geom_TrimmedCurve trimmedCurve = new Geom_TrimmedCurve(curve, start, end);
        return trimmedCurve;
    }

    static TopoDS_Edge trim(const TopoDS_Edge& edge, double start, double end)
    {
        double u1(0.0), u2(0.0);
        auto curve = BRep_Tool::Curve(edge, u1, u2);
        BRepBuilderAPI_MakeEdge builder(curve, start, end);
        return builder.Edge();
    }

    static TopoDS_Edge offset(const TopoDS_Edge& edge, const gp_Dir& dir, double offset)
    {
        double start(0.0), end(0.0);
        auto curve = BRep_Tool::Curve(edge, start, end);
        Handle_Geom_TrimmedCurve trimmedCurve = new Geom_TrimmedCurve(curve, start, end);
        Handle_Geom_OffsetCurve offsetCurve = new Geom_OffsetCurve(trimmedCurve, offset, dir);
        BRepBuilderAPI_MakeEdge builder(offsetCurve);
        return builder.Edge();
    }

    static PointAndParameterArray intersect(const TopoDS_Edge& edge, const TopoDS_Edge& otherEdge)
    {
        std::vector<PointAndParameter> points;
        BRepExtrema_ExtCC cc(edge, otherEdge);
        if (cc.IsDone() && cc.NbExt() > 0 && !cc.IsParallel()) {
            for (int i = 1; i <= cc.NbExt(); i++) {
                if (cc.SquareDistance(i) > Precision::Intersection()) {
                    continue;
                }
                PointAndParameter pointAndParameter = {
                    Vector3::fromPnt(cc.PointOnE1(i)),
                    cc.ParameterOnE1(i),
                };
                points.push_back(pointAndParameter);
            }
        }

        return PointAndParameterArray(val::array(points));
    }
};

class Wire {
public:
    static TopoDS_Shape offset(const TopoDS_Wire& wire, double distance, const GeomAbs_JoinType& joinType)
    {
        BRepOffsetAPI_MakeOffset offsetter(wire, joinType);
        offsetter.Perform(distance);
        if (offsetter.IsDone()) {
            return offsetter.Shape();
        }
        return TopoDS_Shape();
    }

    static TopoDS_Face makeFace(const TopoDS_Wire& wire)
    {
        BRepBuilderAPI_MakeFace face(wire);
        return face.Face();
    }

    static EdgeArray edgeLoop(const TopoDS_Wire& wire)
    {
        std::vector<TopoDS_Edge> edges;
        BRepTools_WireExplorer explorer(wire);
        for (; explorer.More(); explorer.Next()) {
            edges.push_back(TopoDS::Edge(explorer.Current()));
        }
        return EdgeArray(val::array(edges));
    }
};

class Face {
public:
    static double area(const TopoDS_Face& face)
    {
        GProp_GProps props;
        BRepGProp::SurfaceProperties(face, props);
        return props.Mass();
    }

    static TopoDS_Shape offset(const TopoDS_Face& face, double distance, const GeomAbs_JoinType& joinType)
    {
        BRepOffsetAPI_MakeOffset offsetter(face, joinType);
        offsetter.Perform(distance);
        if (offsetter.IsDone()) {
            return offsetter.Shape();
        }
        return TopoDS_Shape();
    }

    static Domain curveOnSurface(const TopoDS_Face& face, const TopoDS_Edge& edge)
    {
        double start(0.0), end(0.0);
        if (BRep_Tool::CurveOnSurface(edge, face, start, end).IsNull()) {
            return Domain();
        }
        Domain domain = { start, end };
        return domain;
    }

    static void normal(const TopoDS_Face& face, double u, double v, gp_Pnt& point, gp_Vec& normal)
    {
        BRepGProp_Face gpProp(face);
        gpProp.Normal(u, v, point, normal);
    }

    static WireArray wires(const TopoDS_Face& face)
    {
        std::vector<TopoDS_Wire> wires;
        TopExp_Explorer explorer;
        for (explorer.Init(face, TopAbs_WIRE); explorer.More(); explorer.Next()) {
            wires.push_back(TopoDS::Wire(explorer.Current()));
        }
        return WireArray(val::array(wires));
    }

    static TopoDS_Wire outerWire(const TopoDS_Face& face)
    {
        return BRepTools::OuterWire(face);
    }

    static Handle_Geom_Surface surface(const TopoDS_Face& face)
    {
        return BRep_Tool::Surface(face);
    }
};

class Solid {
public:
    static double volume(const TopoDS_Solid& solid)
    {
        GProp_GProps props;
        BRepGProp::VolumeProperties(solid, props);
        return props.Mass();
    }
};

EMSCRIPTEN_BINDINGS(Shape)
{
    // 绑定 Shape 类（静态工具函数集合）
    class_<Shape>("Shape")
        // clone(shape) -> TopoDS_Shape：复制/克隆给定拓扑形状并返回新 Shape
        .class_function("clone", &Shape::clone)
        // findAncestor(from, subShape, ancestorType) -> ShapeArray：在 from 中查找 subShape 的指定类型祖先
        .class_function("findAncestor", &Shape::findAncestor)
        // findSubShapes(shape, shapeType) -> ShapeArray：在 shape 中查找指定类型的所有子形状并返回数组
        .class_function("findSubShapes", &Shape::findSubShapes)
        // iterShape(shape) -> ShapeArray：遍历 shape 的直接子节点并返回 JS 数组
        .class_function("iterShape", &Shape::iterShape)
        // sectionSS(shape, otherShape) -> TopoDS_Shape：计算两个 shape 的截交线（shape-shape 切割/截面）
        .class_function("sectionSS", &Shape::sectionSS)
        // sectionSP(shape, pln) -> TopoDS_Shape：计算 shape 与平面 pln 的截交线
        .class_function("sectionSP", &Shape::sectionSP)
        // isClosed(shape) -> bool：判断给定拓扑是否为封闭（封闭边/线等）
        .class_function("isClosed", &Shape::isClosed)
        // splitShapes(arguments, tools) -> TopoDS_Shape：用 tools 拆分 arguments 并返回结果形状
        .class_function("splitShapes", &Shape::splitShapes)
        // removeFeature(shape, faces) -> TopoDS_Shape：对 shape 执行 defeaturing（移除指定面/特征）
        .class_function("removeFeature", &Shape::removeFeature)
        // removeSubShape(shape, subShapes) -> TopoDS_Shape：从 shape 中移除指定子形状及相关关联（并修复）
        .class_function("removeSubShape", &Shape::removeSubShape)
        // replaceSubShape(shape, subShape, newShape) -> TopoDS_Shape：用 newShape 替换 subShape 并返回修复结果
        .class_function("replaceSubShape", &Shape::replaceSubShape)
        // hlr(shape, point, direction, xDirection) -> TopoDS_Shape：对 shape 生成 HLR（隐藏线）结果的复合体
        .class_function("hlr", &Shape::hlr)
        // sewing(shape1, shape2) -> TopoDS_Shape：缝合两个形状并返回缝合后的形状
        .class_function("sewing", &Shape::sewing);

    // 绑定 Vertex 类（顶点工具）
    class_<Vertex>("Vertex")
        // point(vertex) -> Vector3：获取顶点的三维坐标并返回 Vector3
        .class_function("point", &Vertex::point);

    // 绑定 Edge 类（边相关操作）
    class_<Edge>("Edge")
        // fromCurve(curve) -> TopoDS_Edge：由 Geom_Curve 构造一个边（允许传入原始指针）
        .class_function("fromCurve", &Edge::fromCurve, allow_raw_pointers())
        // curve(edge) -> Handle_Geom_TrimmedCurve：从边提取修剪曲线（参数区间封装为 TrimmedCurve）
        .class_function("curve", &Edge::curve)
        // curveLength(edge) -> double：计算边的长度（基于 BRepGProp 线性属性）
        .class_function("curveLength", &Edge::curveLength)
        // trim(edge, start, end) -> TopoDS_Edge：按参数区间修剪边并返回新边
        .class_function("trim", &Edge::trim)
        // intersect(edge, otherEdge) -> PointAndParameterArray：计算两条边的交点/最近点并返回点与参数数组
        .class_function("intersect", &Edge::intersect)
        // offset(edge, dir, offset) -> TopoDS_Edge：沿给定方向偏移边并返回偏移后的边
        .class_function("offset", &Edge::offset);

    // 绑定 Wire 类（线相关操作）
    class_<Wire>("Wire")
        // offset(wire, distance, joinType) -> TopoDS_Shape：对整条线做偏移（生成面/实体），返回偏移结果
        .class_function("offset", &Wire::offset)
        // makeFace(wire) -> TopoDS_Face：由闭合 wire 构造面并返回 Face
        .class_function("makeFace", &Wire::makeFace)
        // edgeLoop(wire) -> EdgeArray：获取 wire 上按循环顺序的边数组
        .class_function("edgeLoop", &Wire::edgeLoop);

    // 绑定 Face 类（面相关操作）
    class_<Face>("Face")
        // area(face) -> double：计算面的表面积（使用 BRepGProp 的表面属性）
        .class_function("area", &Face::area)
        // offset(face, distance, joinType) -> TopoDS_Shape：对面进行偏移操作并返回新形状（若成功）
        .class_function("offset", &Face::offset)
        // outerWire(face) -> TopoDS_Wire：获取面的外边界线（外轮廓）
        .class_function("outerWire", &Face::outerWire)
        // surface(face) -> Handle_Geom_Surface：获取面的底层几何曲面句柄
        .class_function("surface", &Face::surface)
        // normal(face, u, v, point, normalVec) -> void：在给定参数 (u,v) 处计算点与法向量（通过引用返回）
        .class_function("normal", &Face::normal)
        // curveOnSurface(face, edge) -> Domain：返回边在面上的参数区间（start,end），若不存在则返回空 Domain
        .class_function("curveOnSurface", &Face::curveOnSurface);

    // 绑定 Solid 类（实体相关操作）
    class_<Solid>("Solid")
        // volume(solid) -> double：计算实体的体积（使用 BRepGProp 的体积属性）
        .class_function("volume", &Solid::volume);
}
