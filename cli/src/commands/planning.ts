export const getPlanningPrompt =
	() => `**CRITICAL MANDATE: DEEP CODEBASE ANALYSIS**
Your primary and non-negotiable directive is to build a deep, foundational knowledge base of the project by performing a rigorous traversal of the codebase. This is not a surface-level scan.

**Minimum Success Criteria:**
1.  You **must** read a sufficient number of files to understand the core logic. For any non-trivial project, this means reading **at least 8-12 key source files** (e.g., controllers, services, models, main entry points). Reading only configuration files is a failure.
2.  You **must** trace the primary execution flow. Start from the application entry point and follow the logic through the different layers of the application.
3.  Your analysis **must not** conclude until you have fulfilled the explicit Exit Condition outlined in Phase 3.

This mandate for a deep dive overrides any other general instructions you may have about conserving tool usage. Fulfilling this is your top priority. All subsequent phases in this protocol are in service of this core directive.

# The Onboarding Protocol:
Follow this protocol step-by-step to deconstruct and understand the project.

## Phase 1: High-Level Triage & Structural Scan
Your immediate goal is to get the lay of theland.

1. Prioritize the README: Before anything else, locate and read the README.md file. It is the single most important source of project context, setup instructions, and purpose.
2. Map the Directory Tree: Perform a recursive listing of all files and directories. This gives you a complete blueprint of the project's structure.
3. Identify Key Architectural Files: Scan the root directory for critical configuration files that define the project's ecosystem. Look for:
   - Dependency Management: package.json, pom.xml, requirements.txt, Gemfile, go.mod, Cargo.toml.
   - Containerization & Orchestration: Dockerfile, docker-compose.yml.
   - CI/CD Pipelines: .github/workflows/, .gitlab-ci.yml.
   - Environment Configuration: .env.example, config.yaml.example.

## Phase 2: Technology & Execution Analysis
Now, dig into the files you identified to understand the "what" and "how".

1. Parse Dependency Files: Read the contents of the dependency management file(s). Create two distinct lists:
   - Core Dependencies: Libraries and frameworks essential for the application to run in production.
   - Development Dependencies: Tools used for testing, linting, and building (e.g., jest, eslint, webpack).
2. Extract Key Technologies: Based on the dependencies and file extensions (.js, .py, .go, .java), compile a definitive list of technologies:
   - Primary Language(s):
   - Core Framework(s) / Libraries: (e.g., React, Express, Django, Spring Boot)
   - Testing Framework(s): (e.g., Jest, Pytest, JUnit)
   - Build Tools / Bundlers: (e.g., Webpack, Maven, Gradle)
3. Identify Runnable Commands: This is crucial. Scrutinize files like package.json (under "scripts"), Makefile, or pom.xml to find the exact commands for:
   - Installing dependencies (e.g., npm install)
   - Running the application locally (e.g., npm run dev)
   - Running tests (e.g., npm test)
   - Building the project for production (e.g., npm run build)

## Phase 3: Deep Code & Logic Investigation (CRITICAL)
This is the most important phase. A superficial analysis is not acceptable. Your goal is to move beyond file names and understand the *actual code* and its purpose. You must be relentless in your investigation.

1.  **Start at the Entry Point:** Begin with the application entry point you identified in Phase 2. Read this file first.
2.  **Initiate an Investigative Loop:** You will now enter a cycle of reading files, identifying connections, and deepening your understanding. Follow these steps repeatedly:
    a. **Read the Current File:** Analyze the source code of the file you are investigating.
    b. **Identify Key Imports & Dependencies:** Look at the imports at the top of the file. These are your clues to the most important collaborators and dependencies of the current file.
    c. **Formulate Questions:** Based on the code, ask questions. For example: "This controller imports \`OrderService\`. What methods does \`OrderService\` have? What does it do?"
    d. **Add to Your Investigation Queue:** Add the imported files that seem most relevant to a mental "queue" of files to read next. Prioritize files that appear to be services, models, or controllers.
3.  **Use Tests as a Shortcut:** Test files are a goldmine. Read the test files you identified. The test descriptions (\`it('should do X')\`) will explicitly tell you what the application's features are supposed to be.
4.  **Exit Condition:** **Do not stop** until you can confidently answer the following questions:
    - What are the primary data models/entities of the application? (e.g., User, Product, Post)
    - How does the application handle incoming requests (e.g., API routes, controllers)?
    - Where is the core business logic encapsulated? (e.g., in "service" or "use case" files)
    - What are at least 3-5 key features of the application?

Only when you have satisfactory answers to these questions may you proceed to the final phase.

## Phase 4: Synthesis & Final Reporting
**After, and only after, completing the deep investigation in Phase 3,** you will consolidate all your findings into a single, detailed markdown report. The quality and depth of this report is a direct reflection of the quality of your investigation.

1. Create the Report File: Write the complete markdown report to a file located at ./.wingman/instructions.md. This file will serve as our shared understanding and reference point. Create the .wingman directory if it does not exist.
2. Use the Following Structure:

<file_format type="markdown">
# Wingman Project Analysis

### **Project Summary**
*A one-sentence summary of the project's likely purpose based on all evidence.*

---

### **Technology Stack**
- **Language(s):**
- **Framework(s) / Core Libraries:**
- **Database/Persistence:** *(Infer if possible, e.g., from an ORM like Prisma, Sequelize, Hibernate)*
- **Testing Framework(s):**
- **Build Tools/Bundlers:**

---

### **Project Structure Overview**
- **\`src\`**: *Brief description of its likely role (e.g., "Contains the main application source code.").*
- **\`tests\`**: *Brief description (e.g., "Contains unit and integration tests.").*
- **\`config\`**: *...and so on for other key directories.*

---

### **Execution & Key Commands**
*The essential commands needed to work with this project.*
- **Install Dependencies:** \`...\`
- **Run Development Server:** \`...\`
- **Run Tests:** \`...\`
- **Build for Production:** \`...\`

---

### **Core Functionality & Business Domain**
*An inferred list of the application's key features and business concepts.*
- **Business Domain:** *(e.g., E-commerce, Task Management, Social Media)*
- **Key Features:**
    - *(e.g., User Authentication (inferred from \`auth.js\`, \`LoginController.java\`))*
    - *(e.g., Order Processing (inferred from \`services/OrderService.js\`))*
    - *(...list other key features)*

---

### **Potential Next Steps & Questions**
*Your proactive analysis.*
- **Areas of Uncertainty:** *(e.g., "The database type is not explicitly defined.")*
- **Suggested First Action:** *(e.g., "I recommend running the tests first to confirm the environment is set up correctly.")*
</file_format>
`;
