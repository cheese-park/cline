import path from "path"
import { defineConfig } from "vitest/config"

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
		coverage: {
			reporter: ["text", "json", "html"],
			include: ["src/**/*.{ts,tsx}"],
			exclude: [
				"node_modules/",
				"dist/",
				"src/**/*.test.{ts,tsx}",
				"src/test-mocks/**",
				"src/stub-devtools.js",
				"src/components/AsciiMotionCli.tsx",
			],
		},
	},
	resolve: {
		alias: {
			// Proto mock aliases (must come before @ aliases for specificity)
			"@/shared/proto/index": path.resolve(__dirname, "./src/test-mocks/proto-index.ts"),
			"@/shared/proto/cline/file": path.resolve(__dirname, "./src/test-mocks/proto-file.ts"),
			"@/shared/proto/cline/task": path.resolve(__dirname, "./src/test-mocks/proto-task.ts"),
			"@/shared/proto/cline/common": path.resolve(__dirname, "./src/test-mocks/proto-common.ts"),
			"@/shared/proto/cline/slash": path.resolve(__dirname, "./src/test-mocks/proto-slash.ts"),
			"@/shared/proto/cline/models": path.resolve(__dirname, "./src/test-mocks/proto-models.ts"),
			"@shared/proto/index": path.resolve(__dirname, "./src/test-mocks/proto-index.ts"),
			"@shared/proto/cline/file": path.resolve(__dirname, "./src/test-mocks/proto-file.ts"),
			"@shared/proto/cline/task": path.resolve(__dirname, "./src/test-mocks/proto-task.ts"),
			"@shared/proto/cline/common": path.resolve(__dirname, "./src/test-mocks/proto-common.ts"),
			"@shared/proto/cline/slash": path.resolve(__dirname, "./src/test-mocks/proto-slash.ts"),
			"@shared/proto/cline/models": path.resolve(__dirname, "./src/test-mocks/proto-models.ts"),
			// Match tsconfig paths - baseUrl is parent directory
			"@": path.resolve(__dirname, "../src"),
			"@api": path.resolve(__dirname, "../src/core/api"),
			"@core": path.resolve(__dirname, "../src/core"),
			"@generated": path.resolve(__dirname, "../src/generated"),
			"@hosts": path.resolve(__dirname, "../src/hosts"),
			"@integrations": path.resolve(__dirname, "../src/integrations"),
			"@packages": path.resolve(__dirname, "../src/packages"),
			"@services": path.resolve(__dirname, "../src/services"),
			"@shared": path.resolve(__dirname, "../src/shared"),
			"@utils": path.resolve(__dirname, "../src/utils"),
		},
	},
})
