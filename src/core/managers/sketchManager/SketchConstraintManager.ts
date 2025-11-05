// 草图约束管理器，负责增删查、序列化、反序列化等
import { SketchConstraint } from '../../../domain/models/SketchModel';

export class SketchConstraintManager {
  private constraints: SketchConstraint[] = [];

  addConstraint(type: string, entities: number[]) {
    this.constraints.push({ type, entities });
  }

  removeConstraint(index: number) {
    this.constraints.splice(index, 1);
  }

  getConstraints(): SketchConstraint[] {
    return this.constraints;
  }

  clear() {
    this.constraints = [];
  }

  // 可扩展：序列化/反序列化等
}
