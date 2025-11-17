import { IApplication } from "../application"; // 导入应用程序接口
import { AsyncController, IDisposable, Observable, PubSub } from "../foundation"; // 导入基础类和接口，包括异步控制器、可释放接口、可观察类和发布订阅模式
import { Property } from "../property"; // 导入属性系统

// 定义命令接口，包含一个执行方法
export interface ICommand {
    execute(application: IApplication): Promise<void>; // 执行命令的方法，接受一个应用程序实例并返回一个Promise
}

// 定义可取消的命令接口，继承自命令接口和可释放接口，包含一个取消方法
export interface ICanclableCommand extends ICommand, IDisposable {
    cancel(): Promise<void>; // 取消命令的方法，返回一个Promise
}

// 命令接口的命名空间，包含一个静态方法用于判断命令是否可取消
export namespace ICommand {
    // 检查命令是否实现了可取消命令的接口
    export function isCancelableCommand(command: ICommand): command is ICanclableCommand {
        return "cancel" in command; // 返回命令对象中是否存在"cancel"方法
    }
}

// 定义一个可取消命令的抽象类，继承自可观察类并实现可取消命令接口
export abstract class CancelableCommand extends Observable implements ICanclableCommand {
    // 所有命令共享的属性缓存
    private static readonly _propertiesCache: Map<string, any> = new Map<string, any>();
    
    // 用于管理需要释放的资源
    protected readonly disposeStack: Set<IDisposable> = new Set<IDisposable>();

    // 标记命令是否完成
    private _isCompleted: boolean = false;
    get isCompleted() {
        return this._isCompleted; // 返回命令是否完成的状态
    }

    // 标记命令是否被取消
    private _isCanceled: boolean = false;
    get isCanceled() {
        return this._isCanceled; // 返回命令是否被取消的状态
    }

    // 存储应用程序实例
    private _application: IApplication | undefined;
    get application() {
        if (!this._application) {
            throw new Error("application is not set"); // 如果应用程序实例未设置，抛出错误
        }
        return this._application; // 返回应用程序实例
    }

    // 获取当前文档
    get document() {
        return this.application.activeView?.document!; // 返回当前活动视图的文档，不为空断言
    }

    // 私有属性，存储异步控制器实例
    #controller?: AsyncController;
    protected get controller() {
        return this.#controller; // 返回异步控制器实例
    }
    protected set controller(value: AsyncController | undefined) {
        if (this.#controller === value) return; // 如果设置的控制器与当前相同，直接返回
        this.#controller?.dispose(); // 如果当前控制器存在，释放资源
        this.#controller = value; // 设置新的控制器实例
    }

    // 定义取消命令的方法，使用属性装饰器进行注册
    async cancel() {
        this._isCanceled = true; // 设置命令为取消状态

        this.controller?.cancel(); // 使用控制器取消异步操作
        while (!this._isCompleted) {
            await new Promise((r) => setTimeout(r, 30)); // 每30毫秒检查一次命令是否完成
        }
    }

    // 定义是否重复操作的属性，使用属性装饰器进行注册
    get repeatOperation() {
        return this.getPrivateValue("repeatOperation", false); // 获取是否重复操作的值，默认为false
    }

    // 设置是否重复操作的值
    set repeatOperation(value: boolean) {
        this.setProperty("repeatOperation", value); // 设置属性值
    }

    // 标记命令是否正在重启
    protected _isRestarting: boolean = false;

    // 重启命令的执行
    protected async restart() {
        this._isRestarting = true; // 设置命令为正在重启状态
        await this.cancel(); // 调用取消命令的方法
    }

    // 在命令重启前调用的方法
    protected onRestarting() {}

    // 命令执行的主要方法
    async execute(application: IApplication): Promise<void> {
        if (!application.activeView?.document) return; // 如果没有活动视图或文档，直接返回
        this._application = application; // 设置应用程序实例

        try {
            this.beforeExecute(); // 执行前的准备工作

            await this.executeAsync(); // 执行异步命令逻辑

            // 循环执行命令直到不再需要重启或重复操作
            while (this._isRestarting || (!this.checkCanceled() && this.repeatOperation)) {
                this._isRestarting = false; // 重置重启状态

                this.onRestarting(); // 在每次重启前调用的方法
                await this.executeAsync(); // 再次执行异步命令逻辑
            }
        } finally {
            this.afterExecute(); // 执行后的清理工作
        }
    }

    // 检查命令是否被取消或其控制器的结果状态是否为取消
    protected checkCanceled() {
        if (this.isCanceled) {
            return true; // 如果命令被取消，返回true
        }

        if (this.controller?.result?.status === "cancel") {
            return true; // 如果控制器的结果状态为取消，返回true
        }

        return false; // 否则返回false
    }

    // 定义一个抽象方法，需要在子类中实现具体的命令执行逻辑
    protected abstract executeAsync(): Promise<void>;

    // 在命令执行前读取并恢复缓存的属性
    protected beforeExecute() {
        this.readProperties(); // 读取属性
        PubSub.default.pub("openCommandContext", this); // 发布命令上下文打开事件
    }

    // 在命令执行后保存属性到缓存，并释放所有被注册的资源
    protected afterExecute() {
        this.saveProperties(); // 保存属性
        PubSub.default.pub("closeCommandContext"); // 发布命令上下文关闭事件
        this.controller?.dispose(); // 释放控制器资源
        this.disposeStack.forEach((x) => x.dispose()); // 释放所有可释放资源
        this.disposeStack.clear(); // 清空资源释放栈
        this._isCompleted = true; // 设置命令为完成状态
    }

    // 读取缓存的属性
    private readProperties() {
        Property.getProperties(this).forEach((x) => {
            let key = this.cacheKeyOfProperty(x); // 获取属性的缓存键
            if (CancelableCommand._propertiesCache.has(key)) {
                this.setPrivateValue(key as keyof this, CancelableCommand._propertiesCache.get(key)); // 恢复属性值
            }
        });
    }

    // 保存属性到缓存
    private saveProperties() {
        Property.getProperties(this).forEach((x) => {
            let key = this.cacheKeyOfProperty(x); // 获取属性的缓存键
            let prop = (this as any)[key];
            if (typeof prop === "function") return; // 如果属性是函数，跳过
            CancelableCommand._propertiesCache.set(key, prop); // 保存属性到缓存
        });
    }

    // 获取属性的缓存键
    private cacheKeyOfProperty(property: Property) {
        return property.name; // 返回属性名作为缓存键
    }
}
