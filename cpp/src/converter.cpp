// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

#include <emscripten/bind.h>
#include <emscripten/val.h>

#include <BRepBuilderAPI_MakeSolid.hxx>
#include <BRepBuilderAPI_Sewing.hxx>
#include <BRepMesh_IncrementalMesh.hxx>
#include <BRepTools.hxx>
#include <BRep_Builder.hxx>
#include <IGESCAFControl_Reader.hxx>
#include <IGESControl_Writer.hxx>
#include <Quantity_Color.hxx>
#include <STEPCAFControl_Reader.hxx>
#include <STEPControl_Writer.hxx>
#include <StlAPI_Reader.hxx>
#include <StlAPI_Writer.hxx>
#include <TDF_ChildIterator.hxx>
#include <TDF_Label.hxx>
#include <TDataStd_Name.hxx>
#include <TDocStd_Document.hxx>
#include <TopoDS_Iterator.hxx>
#include <TopoDS_Shape.hxx>
#include <XCAFDoc_ColorTool.hxx>
#include <XCAFDoc_DocumentTool.hxx>
#include <XCAFDoc_ShapeTool.hxx>

#include "shared.hpp"
#include "utils.hpp"

using namespace emscripten;

class VectorBuffer : public std::streambuf {
public:
    VectorBuffer(const std::vector<uint8_t>& v)
    {
        setg((char*)v.data(), (char*)v.data(), (char*)(v.data() + v.size()));
    }
};

EMSCRIPTEN_DECLARE_VAL_TYPE(ShapeNodeArray)

struct ShapeNode {
    std::optional<TopoDS_Shape> shape;
    std::optional<std::string> color;
    std::vector<ShapeNode> children;
    std::string name;

    ShapeNodeArray getChildren() const
    {
        return ShapeNodeArray(val::array(children));
    }
};

// copy from https://github.com/kovacsv/occt-import-js/blob/main/occt-import-js/src/importer-xcaf.cpp
std::string getLabelNameNoRef(const TDF_Label& label)
{
    Handle(TDataStd_Name) nameAttribute = new TDataStd_Name();
    if (!label.FindAttribute(nameAttribute->GetID(), nameAttribute)) {
        return std::string();
    }

    Standard_Integer utf8NameLength = nameAttribute->Get().LengthOfCString();
    char* nameBuf = new char[utf8NameLength + 1];
    nameAttribute->Get().ToUTF8CString(nameBuf);
    std::string name(nameBuf, utf8NameLength);
    delete[] nameBuf;
    return name;
}

std::string getLabelName(const TDF_Label& label, const Handle(XCAFDoc_ShapeTool) & shapeTool)
{
    if (XCAFDoc_ShapeTool::IsReference(label)) {
        TDF_Label referredShapeLabel;
        shapeTool->GetReferredShape(label, referredShapeLabel);
        return getLabelName(referredShapeLabel, shapeTool);
    }
    return getLabelNameNoRef(label);
}

std::string getShapeName(const TopoDS_Shape& shape, const Handle(XCAFDoc_ShapeTool) & shapeTool)
{
    TDF_Label shapeLabel;
    if (!shapeTool->Search(shape, shapeLabel)) {
        return std::string();
    }
    return getLabelName(shapeLabel, shapeTool);
}

bool getLabelColorNoRef(const TDF_Label& label, const Handle(XCAFDoc_ColorTool) & colorTool, std::string& color)
{
    static const std::vector<XCAFDoc_ColorType> colorTypes = { XCAFDoc_ColorSurf, XCAFDoc_ColorCurv, XCAFDoc_ColorGen };

    Quantity_Color qColor;
    for (XCAFDoc_ColorType colorType : colorTypes) {
        if (colorTool->GetColor(label, colorType, qColor)) {
            color = std::string(Quantity_Color::ColorToHex(qColor).ToCString());
            return true;
        }
    }

    return false;
}

bool getLabelColor(const TDF_Label& label, const Handle(XCAFDoc_ShapeTool) & shapeTool,
    const Handle(XCAFDoc_ColorTool) & colorTool, std::string& color)
{
    if (getLabelColorNoRef(label, colorTool, color)) {
        return true;
    }

    if (XCAFDoc_ShapeTool::IsReference(label)) {
        TDF_Label referredShape;
        shapeTool->GetReferredShape(label, referredShape);
        return getLabelColor(referredShape, shapeTool, colorTool, color);
    }

    return false;
}

bool getShapeColor(const TopoDS_Shape& shape, const Handle(XCAFDoc_ShapeTool) & shapeTool,
    const Handle(XCAFDoc_ColorTool) & colorTool, std::string& color)
{
    TDF_Label shapeLabel;
    if (!shapeTool->Search(shape, shapeLabel)) {
        return false;
    }
    return getLabelColor(shapeLabel, shapeTool, colorTool, color);
}

bool isFreeShape(const TDF_Label& label, const Handle(XCAFDoc_ShapeTool) & shapeTool)
{
    TopoDS_Shape tmpShape;
    return shapeTool->GetShape(label, tmpShape) && shapeTool->IsFree(label);
}

bool isMeshNode(const TDF_Label& label, const Handle(XCAFDoc_ShapeTool) & shapeTool)
{
    // if there are no children, it is a mesh node
    if (!label.HasChild()) {
        return true;
    }

    // if it has a subshape child, treat it as mesh node
    bool hasSubShapeChild = false;
    for (TDF_ChildIterator it(label); it.More(); it.Next()) {
        TDF_Label childLabel = it.Value();
        if (shapeTool->IsSubShape(childLabel)) {
            hasSubShapeChild = true;
            break;
        }
    }
    if (hasSubShapeChild) {
        return true;
    }

    // if it doesn't have a freeshape child, treat it as a mesh node
    bool hasFreeShapeChild = false;
    for (TDF_ChildIterator it(label); it.More(); it.Next()) {
        TDF_Label childLabel = it.Value();
        if (isFreeShape(childLabel, shapeTool)) {
            hasFreeShapeChild = true;
            break;
        }
    }
    if (!hasFreeShapeChild) {
        return true;
    }

    return false;
}

ShapeNode initLabelNode(const TDF_Label label, const Handle(XCAFDoc_ShapeTool) shapeTool,
    const Handle(XCAFDoc_ColorTool) colorTool)
{
    std::string color;
    getLabelColor(label, shapeTool, colorTool, color);

    ShapeNode node = {
        .shape = std::nullopt,
        .color = color,
        .children = {},
        .name = getLabelName(label, shapeTool),
    };

    return node;
}

ShapeNode initShapeNode(const TopoDS_Shape& shape, const Handle(XCAFDoc_ShapeTool) & shapeTool,
    const Handle(XCAFDoc_ColorTool) & colorTool)
{
    std::string color;
    getShapeColor(shape, shapeTool, colorTool, color);
    ShapeNode childShapeNode = { .shape = shape, .color = color, .children = {}, .name = getShapeName(shape, shapeTool) };
    return childShapeNode;
}

ShapeNode initGroupNode(const TopoDS_Shape& shape, const Handle_XCAFDoc_ShapeTool& shapeTool)
{
    ShapeNode groupNode = {
        .shape = std::nullopt, .color = std::nullopt, .children = {}, .name = getShapeName(shape, shapeTool)
    };

    return groupNode;
}

ShapeNode parseShape(TopoDS_Shape& shape, const Handle_XCAFDoc_ShapeTool& shapeTool,
    const Handle_XCAFDoc_ColorTool& colorTool)
{
    if (shape.ShapeType() == TopAbs_COMPOUND || shape.ShapeType() == TopAbs_COMPSOLID) {
        auto node = initGroupNode(shape, shapeTool);
        TopoDS_Iterator iterator(shape);
        while (iterator.More()) {
            auto subShape = iterator.Value();
            node.children.push_back(parseShape(subShape, shapeTool, colorTool));
            iterator.Next();
        }
        return node;
    }
    return initShapeNode(shape, shapeTool, colorTool);
}

ShapeNode parseLabelToNode(const TDF_Label& label, const Handle(XCAFDoc_ShapeTool) & shapeTool,
    const Handle(XCAFDoc_ColorTool) & colorTool)
{
    if (isMeshNode(label, shapeTool)) {
        auto shape = shapeTool->GetShape(label);
        return parseShape(shape, shapeTool, colorTool);
    }

    auto node = initLabelNode(label, shapeTool, colorTool);
    for (TDF_ChildIterator it(label); it.More(); it.Next()) {
        auto childLabel = it.Value();
        if (isFreeShape(childLabel, shapeTool)) {
            auto childNode = parseLabelToNode(childLabel, shapeTool, colorTool);
            node.children.push_back(childNode);
        }
    }
    return node;
}

ShapeNode parseRootLabelToNode(const Handle(XCAFDoc_ShapeTool) & shapeTool, const Handle(XCAFDoc_ColorTool) & colorTool)
{
    auto label = shapeTool->Label();

    ShapeNode node = initLabelNode(label, shapeTool, colorTool);
    for (TDF_ChildIterator it(label); it.More(); it.Next()) {
        auto childLabel = it.Value();
        if (isFreeShape(childLabel, shapeTool)) {
            auto childNode = parseLabelToNode(childLabel, shapeTool, colorTool);
            node.children.push_back(childNode);
        }
    }

    return node;
}

static ShapeNode parseNodeFromDocument(Handle(TDocStd_Document) document)
{
    TDF_Label mainLabel = document->Main();
    Handle(XCAFDoc_ShapeTool) shapeTool = XCAFDoc_DocumentTool::ShapeTool(mainLabel);
    Handle(XCAFDoc_ColorTool) colorTool = XCAFDoc_DocumentTool::ColorTool(mainLabel);

    return parseRootLabelToNode(shapeTool, colorTool);
}

class Converter {
private:
    static TopoDS_Shape sewShapes(const std::vector<TopoDS_Shape>& shapes)
    {
        BRepBuilderAPI_Sewing sewing;
        for (const auto& shape : shapes) {
            sewing.Add(shape);
        }
        sewing.Perform();
        return sewing.SewedShape();
    }

    static void writeBufferToFile(const std::string& fileName, const Uint8Array& buffer)
    {
        std::vector<uint8_t> input = convertJSArrayToNumberVector<uint8_t>(buffer);
        std::ofstream dummyFile;
        dummyFile.open(fileName, std::ios::binary);
        dummyFile.write((char*)input.data(), input.size());
        dummyFile.close();
    }

public:
    static std::string convertToBrep(const TopoDS_Shape& input)
    {
        std::ostringstream oss;
        BRepTools::Write(input, oss);
        return oss.str();
    }

    static TopoDS_Shape convertFromBrep(const std::string& input)
    {
        std::istringstream iss(input);
        TopoDS_Shape output;
        BRep_Builder builder;
        BRepTools::Read(output, iss, builder);
        return output;
    }

    static std::optional<ShapeNode> convertFromStep(const Uint8Array& buffer)
    {
        std::vector<uint8_t> input = convertJSArrayToNumberVector<uint8_t>(buffer);
        VectorBuffer vectorBuffer(input);
        std::istream iss(&vectorBuffer);

        STEPCAFControl_Reader cafReader;
        cafReader.SetColorMode(true);
        cafReader.SetNameMode(true);
        IFSelect_ReturnStatus readStatus = cafReader.ReadStream("stp", iss);

        if (readStatus != IFSelect_RetDone) {
            return std::nullopt;
        }

        Handle(TDocStd_Document) document = new TDocStd_Document("bincaf");
        if (!cafReader.Transfer(document)) {
            return std::nullopt;
        }

        return parseNodeFromDocument(document);
    }

    static std::optional<ShapeNode> convertFromIges(const Uint8Array& buffer)
    {
        std::string dummyFileName = "temp.igs";
        writeBufferToFile(dummyFileName, buffer);

        IGESCAFControl_Reader igesCafReader;
        igesCafReader.SetColorMode(true);
        igesCafReader.SetNameMode(true);
        if (igesCafReader.ReadFile(dummyFileName.c_str()) != IFSelect_RetDone) {
            std::remove(dummyFileName.c_str());
            return std::nullopt;
        }

        Handle(TDocStd_Document) document = new TDocStd_Document("bincaf");
        if (!igesCafReader.Transfer(document)) {
            std::remove(dummyFileName.c_str());
            return std::nullopt;
        }
        std::remove(dummyFileName.c_str());
        return parseNodeFromDocument(document);
    }

    static std::string convertToStep(const ShapeArray& input)
    {
        auto shapes = vecFromJSArray<TopoDS_Shape>(input);
        std::ostringstream oss;
        STEPControl_Writer stepWriter;
        for (const auto& shape : shapes) {
            stepWriter.Transfer(shape, STEPControl_AsIs);
        }
        stepWriter.WriteStream(oss);
        return oss.str();
    }

    static std::string convertToIges(const ShapeArray& input)
    {
        auto shapes = vecFromJSArray<TopoDS_Shape>(input);
        std::ostringstream oss;
        IGESControl_Writer igesWriter;
        for (const auto& shape : shapes) {
            igesWriter.AddShape(shape);
        }
        igesWriter.ComputeModel();
        igesWriter.Write(oss);
        return oss.str();
    }

    static std::optional<ShapeNode> convertFromStl(const Uint8Array& buffer)
    {
        std::string dummyFileName = "temp.stl";
        writeBufferToFile(dummyFileName, buffer);

        StlAPI_Reader stlReader;
        TopoDS_Shape shape;
        if (!stlReader.Read(shape, dummyFileName.c_str())) {
            return std::nullopt;
        }

        ShapeNode node = { .shape = shape, .color = std::nullopt, .children = {}, .name = "STL Shape" };

        return node;
    }
};

EMSCRIPTEN_BINDINGS(Converter)
{
    register_optional<ShapeNode>();

    register_type<ShapeNodeArray>("Array<ShapeNode>");

    // ShapeNode 暴露：表示解析后层次结构节点（可能包含 TopoDS_Shape、颜色、名称与子节点）
    class_<ShapeNode>("ShapeNode")
        // shape 属性：可能为空（group node）或包含具体 TopoDS_Shape（返回引用以避免拷贝）
        .property("shape", &ShapeNode::shape, return_value_policy::reference())
        // color 属性：节点颜色（hex string），可为 std::nullopt
        .property("color", &ShapeNode::color)
        // name 属性：节点/形状的名称（从 XCAF 文档读取）
        .property("name", &ShapeNode::name)
        // getChildren()：返回子节点数组（用于在 JS 端遍历层次结构）
        .function("getChildren", &ShapeNode::getChildren);

    class_<Converter>("Converter")
        // 将 TopoDS_Shape 序列化为 BREP 格式的字符串（使用 BRepTools::Write）
        // JS 侧可直接得到 BREP 文本以便保存或传输
        .class_function("convertToBrep", &Converter::convertToBrep)

        // 从 BREP 格式字符串反序列化为 TopoDS_Shape（使用 BRepTools::Read）
        // 返回值是 TopoDS_Shape，可用于后续几何操作或导出
        .class_function("convertFromBrep", &Converter::convertFromBrep)

        // 从 STEP 文件的字节流解析并构建层次化 ShapeNode（使用 STEPCAFControl_Reader）
        // 实现：读取字节流 -> Transfer 到 TDocStd_Document -> 遍历 XCAF 标签树构建 ShapeNode
        // 返回 std::optional<ShapeNode>，解析失败时返回 nullopt
        .class_function("convertFromStep", &Converter::convertFromStep)

        // 从 IGES 文件的字节流解析并构建层次化 ShapeNode（使用 IGESCAFControl_Reader）
        // 注意：实现会先将字节写入临时文件再调用读入器，成功后移除临时文件
        .class_function("convertFromIges", &Converter::convertFromIges)

        // 将一组 TopoDS_Shape 导出为 STEP 格式的文本字符串（使用 STEPControl_Writer）
        // 实现：遍历输入 shapes -> Transfer 到 writer -> 写入字符串流并返回
        .class_function("convertToStep", &Converter::convertToStep)

        // 将一组 TopoDS_Shape 导出为 IGES 格式的文本字符串（使用 IGESControl_Writer）
        // 实现：遍历输入 shapes -> AddShape / ComputeModel -> 写入字符串流并返回
        .class_function("convertToIges", &Converter::convertToIges)

        // 从 STL 字节流解析为 TopoDS_Shape 并封装为 ShapeNode（使用 StlAPI_Reader）
        // 实现：将字节写入临时 .stl 文件 -> 使用 StlAPI_Reader 读取为 TopoDS_Shape -> 返回包含该 shape 的 ShapeNode
        .class_function("convertFromStl", &Converter::convertFromStl);
}