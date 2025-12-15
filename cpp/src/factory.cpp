// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

#include <emscripten/bind.h>
#include <emscripten/val.h>

#include "shared.hpp"
#include "utils.hpp"
#include <BRepAlgoAPI_BooleanOperation.hxx>
#include <BRepAlgoAPI_Common.hxx>
#include <BRepAlgoAPI_Cut.hxx>
#include <BRepAlgoAPI_Fuse.hxx>
#include <BRepBuilderAPI_GTransform.hxx>
#include <BRepBuilderAPI_MakeEdge.hxx>
#include <BRepBuilderAPI_MakeFace.hxx>
#include <BRepBuilderAPI_MakePolygon.hxx>
#include <BRepBuilderAPI_MakeSolid.hxx>
#include <BRepBuilderAPI_MakeVertex.hxx>
#include <BRepBuilderAPI_MakeWire.hxx>
#include <BRepFilletAPI_MakeChamfer.hxx>
#include <BRepFilletAPI_MakeFillet.hxx>
#include <BRepOffsetAPI_MakePipe.hxx>
#include <BRepOffsetAPI_MakePipeShell.hxx>
#include <BRepOffsetAPI_MakeThickSolid.hxx>
#include <BRepOffsetAPI_ThruSections.hxx>
#include <BRepPrimAPI_MakeBox.hxx>
#include <BRepPrimAPI_MakeCone.hxx>
#include <BRepPrimAPI_MakeCylinder.hxx>
#include <BRepPrimAPI_MakePrism.hxx>
#include <BRepPrimAPI_MakeRevol.hxx>
#include <BRepPrimAPI_MakeSphere.hxx>
#include <BRepProj_Projection.hxx>
#include <Geom_BezierCurve.hxx>
#include <ShapeAnalysis_Edge.hxx>
#include <ShapeAnalysis_WireOrder.hxx>
#include <ShapeUpgrade_UnifySameDomain.hxx>
#include <TopoDS.hxx>
#include <TopoDS_Shape.hxx>
#include <gp_Ax2.hxx>
#include <gp_Circ.hxx>

using namespace emscripten;

struct ShapeResult {
    TopoDS_Shape shape;
    bool isOk;
    std::string error;
};

class ShapeFactory {
public:
    static ShapeResult box(const Pln& ax3, double x, double y, double z)
    {
        gp_Pln pln = Pln::toPln(ax3);
        BRepBuilderAPI_MakeFace makeFace(pln, 0, x, 0, y);
        if (!makeFace.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to create box" };
        }

        gp_Vec vec(pln.Axis().Direction());
        vec.Multiply(z);
        BRepPrimAPI_MakePrism box(makeFace.Face(), vec);
        if (!box.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to create box" };
        }
        return ShapeResult { box.Shape(), true, "" };
    }

    static ShapeResult cone(const Vector3& normal, const Vector3& center, double radius, double radiusUp, double height)
    {
        gp_Ax2 ax2(Vector3::toPnt(center), Vector3::toDir(normal));
        TopoDS_Shape cone = BRepPrimAPI_MakeCone(ax2, radius, radiusUp, height).Shape();
        return ShapeResult { cone, true, "" };
    }

    static ShapeResult sphere(const Vector3& center, double radius)
    {
        TopoDS_Shape sphere = BRepPrimAPI_MakeSphere(Vector3::toPnt(center), radius).Shape();
        return ShapeResult { sphere, true, "" };
    }

    static ShapeResult ellipse(const Vector3& normal, const Vector3& center, const Vector3& xvec, double majorRadius,
        double minorRadius)
    {
        gp_Ax2 ax2(Vector3::toPnt(center), Vector3::toDir(normal), Vector3::toDir(xvec));
        gp_Elips ellipse(ax2, majorRadius, minorRadius);
        BRepBuilderAPI_MakeEdge edge(ellipse);
        if (!edge.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to create ellipse" };
        }
        return ShapeResult { edge.Edge(), true, "" };
    }

    /**
     * TODO
     */
    static ShapeResult ellipsoid(const Vector3& normal, const Vector3& center, const Vector3& xvec, double xRadius,
        double yRadius, double zRadius)
    {
        TopoDS_Shape sphere = BRepPrimAPI_MakeSphere(1).Solid();

        gp_GTrsf transform;
        transform.SetValue(1, 1, xRadius);
        transform.SetValue(2, 2, yRadius);
        transform.SetValue(3, 3, zRadius);
        transform.SetTranslationPart(gp_XYZ(center.x, center.y, center.z));

        BRepBuilderAPI_GTransform builder(sphere, transform);
        if (builder.IsDone()) {
            TopoDS_Shape ellipsoid = builder.Shape();
            return ShapeResult { ellipsoid, true, "" };
        }
        return ShapeResult { TopoDS_Shape(), false, "" };
    }

    static ShapeResult pyramid(const Pln& ax3, double x, double y, double z)
    {
        if (abs(x) <= Precision::Confusion() || abs(y) <= Precision::Confusion() || abs(z) <= Precision::Confusion()) {
            return ShapeResult { TopoDS_Shape(), false, "Invalid dimensions" };
        }

        gp_Pln pln = Pln::toPln(ax3);
        auto xvec = gp_Vec(pln.XAxis().Direction()).Multiplied(x);
        auto yvec = gp_Vec(pln.YAxis().Direction()).Multiplied(y);
        auto zvec = gp_Vec(pln.Axis().Direction()).Multiplied(z);
        auto p1 = pln.Location();
        auto p2 = p1.Translated(xvec);
        auto p3 = p1.Translated(xvec).Translated(yvec);
        auto p4 = p1.Translated(yvec);
        auto top = pln.Location().Translated((xvec + yvec) * 0.5 + zvec);

        std::vector<TopoDS_Face> faces = {
            TopoDS::Face(pointsToFace({ p1, p2, p3, p4, p1 }).shape), TopoDS::Face(pointsToFace({ p1, p2, top, p1 }).shape),
            TopoDS::Face(pointsToFace({ p2, p3, top, p2 }).shape), TopoDS::Face(pointsToFace({ p3, p4, top, p3 }).shape),
            TopoDS::Face(pointsToFace({ p4, p1, top, p4 }).shape)
        };

        return facesToSolid(faces);
    }

    static ShapeResult pointsToFace(std::vector<gp_Pnt>&& points)
    {
        auto wire = pointsToWire(points);
        if (!wire.isOk) {
            return wire;
        }

        BRepBuilderAPI_MakeFace face(TopoDS::Wire(wire.shape));
        if (!face.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to create face" };
        }
        return ShapeResult { face.Face(), true, "" };
    }

    static ShapeResult pointsToWire(std::vector<gp_Pnt>& points)
    {
        BRepBuilderAPI_MakePolygon poly;
        for (auto& p : points) {
            poly.Add(p);
        }
        if (!poly.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to create polygon" };
        }
        return ShapeResult { poly.Wire(), true, "" };
    }

    static ShapeResult facesToSolid(const std::vector<TopoDS_Face>& faces)
    {
        TopoDS_Shell shell;
        BRep_Builder shellBuilder;
        shellBuilder.MakeShell(shell);
        for (const auto& face : faces) {
            shellBuilder.Add(shell, face);
        }

        BRepBuilderAPI_MakeSolid solidBuilder(shell);
        if (!solidBuilder.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to create solid" };
        }

        return ShapeResult { solidBuilder.Solid(), true, "" };
    }

    static ShapeResult cylinder(const Vector3& normal, const Vector3& center, double radius, double height)
    {
        gp_Ax2 ax2(Vector3::toPnt(center), Vector3::toDir(normal));
        BRepPrimAPI_MakeCylinder cylinder(ax2, radius, height);
        cylinder.Build();
        if (!cylinder.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to create cylinder" };
        }
        return ShapeResult { cylinder.Solid(), true, "" };
    }

    static ShapeResult sweep(const ShapeArray& sections, const TopoDS_Wire& path, bool isFrenet, bool isForceC1)
    {
        BRepOffsetAPI_MakePipeShell pipe(path);
        if (isFrenet) {
            pipe.SetMode(isFrenet);
        }

        if (isForceC1) {
            pipe.SetTransitionMode(BRepBuilderAPI_RoundCorner);
            pipe.SetForceApproxC1(isForceC1);
        } else {
            pipe.SetTransitionMode(BRepBuilderAPI_RightCorner);
        }

        std::vector<TopoDS_Shape> shapesVec = vecFromJSArray<TopoDS_Shape>(sections);
        for (const auto& shape : shapesVec) {
            pipe.Add(shape);
        }

        pipe.Build();
        pipe.MakeSolid();

        if (!pipe.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to sweep profile" };
        }
        return ShapeResult { pipe.Shape(), true, "" };
    }

    static ShapeResult revolve(const TopoDS_Shape& profile, const Ax1& axis, double rad)
    {
        BRepPrimAPI_MakeRevol revol(profile, Ax1::toAx1(axis), rad);
        if (!revol.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to revolve profile" };
        }
        return ShapeResult { revol.Shape(), true, "" };
    }

    static ShapeResult prism(const TopoDS_Shape& profile, const Vector3& vec)
    {
        gp_Vec vec3 = Vector3::toVec(vec);
        BRepPrimAPI_MakePrism prism(profile, vec3);
        if (!prism.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to create prism" };
        }
        return ShapeResult { prism.Shape(), true, "" };
    }

    static ShapeResult polygon(const Vector3Array& points)
    {
        std::vector<Vector3> vector3s = vecFromJSArray<Vector3>(points);
        std::vector<gp_Pnt> pnts;
        for (auto& p : vector3s) {
            pnts.push_back(Vector3::toPnt(p));
        }
        return pointsToWire(pnts);
    }

    static ShapeResult arc(const Vector3& normal, const Vector3& center, const Vector3& start, double rad)
    {
        gp_Pnt centerPnt = Vector3::toPnt(center);
        gp_Pnt startPnt = Vector3::toPnt(start);
        gp_Dir xvec = gp_Dir(startPnt.XYZ() - centerPnt.XYZ());
        gp_Ax2 ax2(centerPnt, Vector3::toDir(normal), xvec);
        gp_Circ circ(ax2, centerPnt.Distance(startPnt));
        double startAng(0), endAng(rad);
        if (rad < 0) {
            startAng = Math::PI_2 + rad;
            endAng = Math::PI_2;
        }
        BRepBuilderAPI_MakeEdge edge(circ, startAng, endAng);
        if (!edge.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to create arc" };
        }
        return ShapeResult { edge.Edge(), true, "" };
    }

    static ShapeResult circle(const Vector3& normal, const Vector3& center, double radius)
    {
        gp_Ax2 ax2(Vector3::toPnt(center), Vector3::toDir(normal));
        gp_Circ circ(ax2, radius);
        BRepBuilderAPI_MakeEdge edge(circ);
        if (!edge.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to create circle" };
        }
        return ShapeResult { edge.Edge(), true, "" };
    }

    static ShapeResult rect(const Pln& pln, double width, double height)
    {
        BRepBuilderAPI_MakeFace makeFace(Pln::toPln(pln), 0, width, 0, height);
        if (!makeFace.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to create rectangle" };
        }
        return ShapeResult { makeFace.Face(), true, "" };
    }

    static ShapeResult bezier(const Vector3Array& points, const NumberArray& weights)
    {
        std::vector<Vector3> pts = vecFromJSArray<Vector3>(points);
        TColgp_Array1OfPnt arrayofPnt(1, pts.size());
        for (int i = 0; i < pts.size(); i++) {
            arrayofPnt.SetValue(i + 1, Vector3::toPnt(pts[i]));
        }

        std::vector<double> wts = vecFromJSArray<double>(weights);
        TColStd_Array1OfReal arrayOfWeight(1, wts.size());
        for (int i = 0; i < wts.size(); i++) {
            arrayOfWeight.SetValue(i + 1, wts[i]);
        }

        Handle_Geom_Curve curve = wts.size() > 0 ? new Geom_BezierCurve(arrayofPnt, arrayOfWeight) : new Geom_BezierCurve(arrayofPnt);
        BRepBuilderAPI_MakeEdge edge(curve);
        if (!edge.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to create bezier" };
        }
        return ShapeResult { edge.Edge(), true, "" };
    }

    static ShapeResult point(const Vector3& point)
    {
        BRepBuilderAPI_MakeVertex makeVertex(Vector3::toPnt(point));
        if (!makeVertex.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to create point" };
        }
        return ShapeResult { makeVertex.Vertex(), true, "" };
    }

    static ShapeResult line(const Vector3& start, const Vector3& end)
    {
        BRepBuilderAPI_MakeEdge makeEdge(Vector3::toPnt(start), Vector3::toPnt(end));
        if (!makeEdge.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to create line" };
        }
        return ShapeResult { makeEdge.Edge(), true, "" };
    }

    static void orderEdge(BRepBuilderAPI_MakeWire& wire, const std::vector<TopoDS_Edge>& edges)
    {
        ShapeAnalysis_WireOrder order;
        ShapeAnalysis_Edge analysis;
        for (auto& edge : edges) {
            order.Add(BRep_Tool::Pnt(analysis.FirstVertex(edge)).XYZ(),
                BRep_Tool::Pnt(analysis.LastVertex(edge)).XYZ());
        }
        order.Perform(true);
        if (order.IsDone()) {
            for (int i = 0; i < order.NbEdges(); i++) {
                int index = order.Ordered(i + 1);
                auto edge = edges[abs(index) - 1];
                if (index < 0) {
                    edge.Reverse();
                }
                wire.Add(edge);
            }
        }
    }

    static ShapeResult wire(const EdgeArray& edges)
    {
        std::vector<TopoDS_Edge> edgesVec = vecFromJSArray<TopoDS_Edge>(edges);
        if (edgesVec.size() == 0) {
            return ShapeResult { TopoDS_Shape(), false, "No edges provided" };
        }
        BRepBuilderAPI_MakeWire wire;
        if (edgesVec.size() == 1) {
            wire.Add(edgesVec[0]);
        } else {
            orderEdge(wire, edgesVec);
        }

        if (!wire.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to create wire" };
        }
        return ShapeResult { wire.Wire(), true, "" };
    }

    static ShapeResult face(const WireArray& wires)
    {
        std::vector<TopoDS_Wire> wiresVec = vecFromJSArray<TopoDS_Wire>(wires);
        BRepBuilderAPI_MakeFace makeFace(wiresVec[0]);
        for (int i = 1; i < wiresVec.size(); i++) {
            makeFace.Add(wiresVec[i]);
        }
        if (!makeFace.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to create face" };
        }
        return ShapeResult { makeFace.Face(), true, "" };
    }

    static ShapeResult shell(const FaceArray& faces)
    {
        std::vector<TopoDS_Face> facesVec = vecFromJSArray<TopoDS_Face>(faces);

        TopoDS_Shell shell;
        BRep_Builder shellBuilder;
        shellBuilder.MakeShell(shell);
        for (const auto& face : facesVec) {
            shellBuilder.Add(shell, face);
        }

        return ShapeResult { shell, true, "" };
    }

    static ShapeResult solid(const ShellArray& shells)
    {
        std::vector<TopoDS_Shell> shellsVec = vecFromJSArray<TopoDS_Shell>(shells);

        BRepBuilderAPI_MakeSolid makeSolid;
        for (auto shell : shellsVec) {
            makeSolid.Add(shell);
        }
        if (!makeSolid.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to create solid" };
        }
        return ShapeResult { makeSolid.Solid(), true, "" };
    }

    static ShapeResult makeThickSolidBySimple(const TopoDS_Shape& shape, double thickness)
    {
        BRepOffsetAPI_MakeThickSolid makeThickSolid;
        makeThickSolid.MakeThickSolidBySimple(shape, thickness);
        if (!makeThickSolid.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to create thick solid" };
        }
        return ShapeResult { makeThickSolid.Shape(), true, "" };
    }

    static ShapeResult makeThickSolidByJoin(const TopoDS_Shape& shape, const ShapeArray& shapes, double thickness)
    {
        TopTools_ListOfShape shapesList = shapeArrayToListOfShape(shapes);

        BRepOffsetAPI_MakeThickSolid makeThickSolid;
        makeThickSolid.MakeThickSolidByJoin(shape, shapesList, thickness, 1e-6);
        if (!makeThickSolid.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to create thick solid" };
        }
        return ShapeResult { makeThickSolid.Shape(), true, "" };
    }

    static ShapeResult simplifyShape(
        const TopoDS_Shape& shape,
        const Standard_Boolean theUnifyEdges,
        const Standard_Boolean theUnifyFaces)
    {
        if (!theUnifyEdges && !theUnifyFaces) {
            return ShapeResult { shape, true, "" };
        }

        ShapeUpgrade_UnifySameDomain anUnifier(shape, theUnifyEdges, theUnifyFaces, Standard_True);
        anUnifier.Build();

        return ShapeResult { anUnifier.Shape(), true, "" };
    }

    static ShapeResult booleanOperate(BRepAlgoAPI_BooleanOperation& boolOperater, const ShapeArray& args,
        const ShapeArray& tools)
    {
        TopTools_ListOfShape argsList = shapeArrayToListOfShape(args);
        TopTools_ListOfShape toolsList = shapeArrayToListOfShape(tools);

        boolOperater.SetToFillHistory(false);
        boolOperater.SetArguments(argsList);
        boolOperater.SetTools(toolsList);
        boolOperater.Build();
        if (!boolOperater.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to build boolean operation" };
        }

        return ShapeResult { boolOperater.Shape(), true, "" };
    }

    static ShapeResult booleanCommon(const ShapeArray& args, const ShapeArray& tools)
    {
        BRepAlgoAPI_Common api;
        return booleanOperate(api, args, tools);
    }

    static ShapeResult booleanCut(const ShapeArray& args, const ShapeArray& tools)
    {
        BRepAlgoAPI_Cut api;
        return booleanOperate(api, args, tools);
    }

    static ShapeResult booleanFuse(const ShapeArray& args, const ShapeArray& tools)
    {
        BRepAlgoAPI_Fuse api;
        return booleanOperate(api, args, tools);
    }

    static ShapeResult combine(const ShapeArray& shapes)
    {
        std::vector<TopoDS_Shape> shapesVec = vecFromJSArray<TopoDS_Shape>(shapes);
        TopoDS_Compound compound;
        BRep_Builder builder;
        builder.MakeCompound(compound);
        for (auto shape : shapesVec) {
            builder.Add(compound, shape);
        }
        return ShapeResult { compound, true, "" };
    }

    static ShapeResult fillet(const TopoDS_Shape& shape, const NumberArray& edges, double radius)
    {
        std::vector<int> edgeVec = vecFromJSArray<int>(edges);

        TopTools_IndexedMapOfShape edgeMap;
        TopExp::MapShapes(shape, TopAbs_EDGE, edgeMap);

        BRepFilletAPI_MakeFillet makeFillet(shape);
        for (auto edge : edgeVec) {
            makeFillet.Add(radius, TopoDS::Edge(edgeMap.FindKey(edge + 1)));
        }
        makeFillet.Build();
        if (!makeFillet.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to fillet" };
        }

        return ShapeResult { makeFillet.Shape(), true, "" };
    }

    static ShapeResult chamfer(const TopoDS_Shape& shape, const NumberArray& edges, double distance)
    {
        std::vector<int> edgeVec = vecFromJSArray<int>(edges);

        TopTools_IndexedMapOfShape edgeMap;
        TopExp::MapShapes(shape, TopAbs_EDGE, edgeMap);

        BRepFilletAPI_MakeChamfer makeChamfer(shape);
        for (auto edge : edgeVec) {
            makeChamfer.Add(distance, TopoDS::Edge(edgeMap.FindKey(edge + 1)));
        }
        makeChamfer.Build();
        if (!makeChamfer.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to chamfer" };
        }
        return ShapeResult { makeChamfer.Shape(), true, "" };
    }

    static ShapeResult loft(const ShapeArray& sections, bool isSolid, bool isRuled, GeomAbs_Shape continuity)
    {
        std::vector<TopoDS_Shape> shapeVector = emscripten::vecFromJSArray<TopoDS_Shape>(sections);
        if (shapeVector.size() < 2) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to loft: at least 2 sections are required" };
        }
        if (shapeVector.size() == 2 && shapeVector[0].ShapeType() == TopAbs_VERTEX && shapeVector[1].ShapeType() == TopAbs_VERTEX) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to loft: must have at least 1 wires" };
        }

        BRepOffsetAPI_ThruSections loftBuilder(isSolid, isRuled);
        if (!isRuled) {
            loftBuilder.SetContinuity(continuity);
        }

        for (auto& profile : shapeVector) {
            if (profile.ShapeType() == TopAbs_WIRE) {
                loftBuilder.AddWire(TopoDS::Wire(profile));
            } else if (profile.ShapeType() == TopAbs_VERTEX) {
                loftBuilder.AddVertex(TopoDS::Vertex(profile));
            }
        }
        loftBuilder.Build();
        if (!loftBuilder.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to loft" };
        }
        return ShapeResult { loftBuilder.Shape(), true, "" };
    }

    static ShapeResult curveProjection(const TopoDS_Shape& curve, const TopoDS_Shape& targetFace, const gp_Dir& dir)
    {
        BRepProj_Projection curveProjection(curve, targetFace, dir);
        if (!curveProjection.IsDone()) {
            return ShapeResult { TopoDS_Shape(), false, "Failed to create curve projection" };
        }
        return ShapeResult { curveProjection.Shape(), true, "" };
    }
};

EMSCRIPTEN_BINDINGS(ShapeFactory)
{
    class_<ShapeResult>("ShapeResult")
        .property("shape", &ShapeResult::shape, return_value_policy::reference())
        .property("isOk", &ShapeResult::isOk)
        .property("error", &ShapeResult::error);

    class_<ShapeFactory>("ShapeFactory")
        // 创建长方体：在指定平面上创建面并沿法线方向挤出形成实体
        .class_function("box", &ShapeFactory::box)

        // 创建圆锥：以给定轴与尺寸构造圆锥实体
        .class_function("cone", &ShapeFactory::cone)

        // 创建球体：在指定中心与半径处生成球体实体
        .class_function("sphere", &ShapeFactory::sphere)

        // 创建椭球：通过缩放单位球并应用变换得到椭球（使用几何变换）
        .class_function("ellipsoid", &ShapeFactory::ellipsoid)

        // 创建椭圆：在给定基准（Ax2）上构造椭圆曲线并返回边
        .class_function("ellipse", &ShapeFactory::ellipse)

        // 创建圆柱：以给定轴、半径和高度构造圆柱实体
        .class_function("cylinder", &ShapeFactory::cylinder)

        // 创建金字塔：在平面上构造底面并连接顶点形成多面体（若尺寸非法返回错误）
        .class_function("pyramid", &ShapeFactory::pyramid)

        // 扫掠（sweep / pipe shell）：沿路径对截面进行扫掠，支持 Frenet 模式与 C1 过渡选项，最终生成实体/壳
        .class_function("sweep", &ShapeFactory::sweep)

        // 旋转体（revolve）：绕指定轴旋转剖面生成实体
        .class_function("revolve", &ShapeFactory::revolve)

        // 棱柱（prism）：沿给定向量对剖面进行拉伸/挤出生成实体
        .class_function("prism", &ShapeFactory::prism)

        // 多边形：由一组顶点构造有序边/闭合线（返回 wire）
        .class_function("polygon", &ShapeFactory::polygon)

        // 圆：在给定中心和平面上构造圆边
        .class_function("circle", &ShapeFactory::circle)

        // 圆弧：在给定中心、起点与角度下构造圆弧边（支持负角度方向）
        .class_function("arc", &ShapeFactory::arc)

        // 贝塞尔曲线：根据控制点和权重构造 Geom_BezierCurve 并返回对应边
        .class_function("bezier", &ShapeFactory::bezier)

        // 矩形：在指定平面上创建矩形面（Face）
        .class_function("rect", &ShapeFactory::rect)

        // 点：创建顶点（Vertex）
        .class_function("point", &ShapeFactory::point)

        // 直线：由起点和终点创建边（Edge）
        .class_function("line", &ShapeFactory::line)

        // 线圈 / Wire：由边数组构造有序或单一边组成的 Wire（含边排序逻辑）
        .class_function("wire", &ShapeFactory::wire)

        // 面：由一组外/内边圈构造面（Face）
        .class_function("face", &ShapeFactory::face)

        // 壳：由面集合构造 Shell（仅组装，不封闭为实体）
        .class_function("shell", &ShapeFactory::shell)

        // 实体：由若干壳构造 Solid（封装成实体）
        .class_function("solid", &ShapeFactory::solid)

        // 简单加厚：对给定 shape 做简单的厚度偏移，返回加厚后的实体
        .class_function("makeThickSolidBySimple", &ShapeFactory::makeThickSolidBySimple)

        // 通过连接加厚：基于一个主 shape 与其它 shapes 生成带厚度的实体（MakeThickSolidByJoin）
        .class_function("makeThickSolidByJoin", &ShapeFactory::makeThickSolidByJoin)

        // 简化几何：统一同域的边或面以减小拓扑冗余（使用 ShapeUpgrade_UnifySameDomain）
        .class_function("simplifyShape", &ShapeFactory::simplifyShape)

        // 布尔运算（求交）：对参数 shapes 与工具 shapes 执行公共（交）操作
        .class_function("booleanCommon", &ShapeFactory::booleanCommon)

        // 布尔运算（差集）：执行 args - tools 差集操作
        .class_function("booleanCut", &ShapeFactory::booleanCut)

        // 布尔运算（并集）：对多个 shape 执行 Fuse（合并）操作
        .class_function("booleanFuse", &ShapeFactory::booleanFuse)

        // 合并：把若干 shape 组装成一个 Compound（不做布尔合并）
        .class_function("combine", &ShapeFactory::combine)

        // 倒角 / 圆角（fillet）：沿指定的边索引执行圆角处理，返回处理后的形状
        .class_function("fillet", &ShapeFactory::fillet)

        // 倒棱（chamfer）：沿指定边索引执行倒棱处理，返回处理后的形状
        .class_function("chamfer", &ShapeFactory::chamfer)

        // 放样（loft）：根据多个截面通过 ThruSections 构造实体或壳，支持实心/生成规则/连续性选项
        .class_function("loft", &ShapeFactory::loft)

        // 曲线投影：将曲线投影到目标面上（沿给定方向），返回投影结果 shape
        .class_function("curveProjection", &ShapeFactory::curveProjection);
}