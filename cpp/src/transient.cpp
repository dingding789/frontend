// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

#include <emscripten/bind.h>
#include <emscripten/val.h>

#include <Standard_Transient.hxx>

using namespace emscripten;

class Transient {
public:
    static bool isKind(const Standard_Transient* t, const std::string& name)
    {
        return t->IsKind(name.c_str());
    }

    static bool isInstance(const Standard_Transient* t, const std::string& name)
    {
        return t->IsInstance(name.c_str());
    }
};

EMSCRIPTEN_BINDINGS(Transient)
{
    // 将辅助类 Transient 绑定到 JS，提供对 Standard_Transient 类型信息的查询工具
    class_<Transient>("Transient")
        // isKind(t, name) -> bool：判断指针 t 是否为 name 指定的类型或其派生类型（对应 OCCT 的 IsKind）
        .class_function("isKind", &Transient::isKind, allow_raw_pointers())
        // isInstance(t, name) -> bool：判断指针 t 是否为精确的 name 类型（对应 OCCT 的 IsInstance）
        .class_function("isInstance", &Transient::isInstance, allow_raw_pointers());
}