**项目结构**
- 前端是 Vite/React 19 应用，代码在 `src/`；普通用户入口渲染 `src/App.tsx`，`/admin` 从 `src/main.tsx` 懒加载 `src/admin/AdminPage.tsx`。
- 后端是独立的 Spring Boot 3.3 / Java 17 Maven 应用，位于 `backend-java/`；入口是 `com.tripcanvas.backend.TripCanvasBackendApplication`。
- 前端 API 默认请求 `http://localhost:3001`，除非设置了 `VITE_BACKEND_URL`；后端默认端口也是 `3001`。

**命令**
- 前端安装、构建、测试都在仓库根目录执行：`npm install`、`npm run build`、`npm test`。
- 前端单测聚焦运行：`npm test -- src/store.test.ts` 或 `npx vitest run src/store.test.ts`。不要用 Jest 参数，例如 `--runInBand`，Vitest 会拒绝。
- 前端开发服务器：`npm run dev`。
- 后端编译/测试在 `backend-java/` 下执行：`mvn test`。当前没有后端测试源码，但这个命令会验证 Java 编译、Lombok 和 MapStruct。

**已知测试状态**
- 当前 `npm test` 有一个无关失败：`src/components/MigrationModal.test.tsx` 断言源码包含 `authUser.username`，但 `Header.tsx` 使用的是可选链 `authUser?.username`。`npm run build` 和 `mvn test` 通过。

**配置和密钥**
- `backend-java/src/main/resources/application.yml` 和 `backend-java/config.json` 被忽略，因为可能包含真实 DB/COS/API 密钥。不要在回复或提交中粘贴它们的内容；安全示例用 `application.yml.example` 和 `config.example.json`。
- 后端 SQL 初始化配置为 `spring.sql.init.mode=always` 且 `continue-on-error=true`；MySQL schema 在 `backend-java/src/main/resources/db/migration/`，`DatabaseBootstrap` 启动时也会补一些缺失列/索引。
- Vite 会尝试加载被忽略的 `dev-proxy.config.json`；如果存在且启用，会通过 `src/lib/devProxy.ts` 定义仅开发环境使用的代理前缀和目标。

**Bug 处理流程**
- 如果遇到暂时没有解决的 bug，使用 lark-task skill（`lark-cli task +create`，`--as user`）把它报到飞书任务里，分配给当前登录用户，并在描述中写清复现步骤、期望行为和排查方向。不要把未解决 bug 只留在对话里。

**仓库特殊点**
- `.gitignore` 有意保留 `backend-java/target/tripcanvas-backend-0.1.0-SNAPSHOT.jar` 可跟踪，同时忽略其他 target 输出。Maven 命令可能让 target 产物变脏；提交前要检查，不要默认所有 `target/` 变化都可丢弃。
- 这个仓库忽略 `README.md` 和 `docs/`，所以可执行配置通常比缺失的文档更可信。
- 后端使用 MapStruct、record 和 mapper；给响应 record 加字段时，通常要同时更新构造调用和 mapper 注解。
