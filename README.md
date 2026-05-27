# 🌌 Gemini Enterprise - Assistant Space Hub

> **High-Fidelity Enterprise Search Grounding & Coordinated ADK Agentic Console**

Assistant Space Hub is a secure, full-stack, real-time grounded exploration dashboard designed to query, compare, and trace private enterprise search engines created in Google Cloud Platform's Discovery Engine API. 

Built with a **FastAPI Backend-for-Frontend (BFF)** proxy architecture, a **Google Agent Development Kit (ADK)** local runner engine, and a **Glassmorphic Space-Theme Web UI**, it integrates direct search proxies streams and an intelligent orchestrated assistant persona to analyze deep document citations (e.g. from financial earnings release PDFs) completely safely.

---

## 📸 Dual-Mode Interactive Chat Interfaces

| 📦 Discovered Data Stores Index Panel | 🛠️ Live Coordinated Python Event Stream |
| :--- | :--- |
| ![Engine Grounded index Panel](docs/assets/dev_console_datastores_list.png) | ![Agent Logs and Terminals Console](docs/assets/agent_logs_console.png) |

---

## 🎨 Visual Verification Walkthroughs

The visual verification walkthrough sequence is documented under **[WALKTHROUGH.md](file:///Users/sokratis/Documents/Code/0_playground/WALKTHROUGH.md)**. 

Open **[adk_agentic_coordinator_demo.webp](file:///Users/sokratis/Documents/Code/0_playground/docs/assets/adk_agentic_coordinator_demo.webp)** to see the animation of our local ADK coordinator agent stream: toggling modes, verifying dynamically connected GCS databases lists, submitting discovery queries, watching tool calls trigger in real-time, outputting comparative revenue tables, and tracking actual python Event dictionaries in console terminals live!

![ADK Space Coordinator Agentic stream Recording](docs/assets/adk_agentic_coordinator_demo.webp)

---

## 🚀 Key Architectural Features Implemented

### 1. Secure Backend-for-Frontend (BFF) Auth Proxy
To completely neutralize risk and comply with standard enterprise token protection rules (**CWE-312: Cleartext Storage** and **CWE-922: Insecure Storage**), all high-privilege credentials and Bearer access tokens are encapsulated entirely server-side. 
*   No service keys or API tokens are ever stored, transmitted, or processed in the client browser's memory scope.
*   FastAPI is bound strictly to localhost `127.0.0.1` and executes rigorous anti-clickjacking headers (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `Content-Security-Policy: default-src 'self'`).

### 2. Conversational Orchestration (Google ADK Local Agent & Runner)
TALK to an advanced corporate coordinator agent directly using natural conversational language.
*   **Local InMemoryRunner Streaming**: FastAPI lazy-loads and instantiates the `google.adk.runners.InMemoryRunner` locally. Traces actual python GenAI Event dictionaries chunk-by-chunk directly into the browser logs response console in real-time.
*   **Dynamic Tool Calling & Warnings Balloons**: Integrates the agent with standard docstring-mapped Python tools. If the agent makes intermediate decisions to list search spaces or query document databases, a custom glowing tool calling status chip renders inside the chat stream in real-time: `🤖 Space Hub Coordinator: [Invoking Tool...]`.
*   **Decoupled Cycles Resolution (Deferred Imports)**: Resolves modular startup dependencies circular dependency locks by implementing deferred imports within tool runtimes, ensuring complete server startup stability.

### 3. Dynamic Datastore Routing Engine
Bypassing the traditional several-hours latency during console sync states:
*   Upon query submission, the BFF automatically interrogates the GCP Engine details in real-time.
*   It dynamically auto-discovers linked database indexes (such as your newly created GCS bucket index `e2e-bucket_1779877581501`).
*   It constructs a dynamic `toolsSpec` POST configuration block on-the-fly and overlays the target indices within the `streamAssist` execution body, delivering instantaneous multi-document search grounding.

### 4. Collapsible Developer Trace Console (Triple-Column Grid Shift)
Clicking `🛠️ Developer Trace Mode` dynamically transitions the fluid web space grid into a triple-column layout, uncollapsing a Frosted Glass Space panel carrying two visual consoles:
*   **Engine Grounded Sources Panel**: Translates mapped indices list arrays returned during discovery to visual storage cards carrying dynamic SVG icons (boxes `📦` for bucket indices, envelopes `✉️` for mail datasets, folders `📁` for drives etc.), user-friendly cleaned display tags, database types, and complete GCP resource ID text fields.
*   **REST API Trace Console**: Maps real-time HTTP interaction shells:
    *   **HTTP POST REQUEST Terminal**: Traces targeted POST methods, raw URL endpoints, masked authorization headers, and a color-coded syntax-highlighted Request JSON Payload.
    *   **LIVE RESPONSE CHUNKS STREAM Terminal**: Emulates an active Linux server logging shell. Carries a red blinking warning indicator dot active during connection streams and prints byte-for-byte the compact transcoded JSON string chunks exactly as flushed by Google Cloud, scrolling container focus margins downward in real-time.

### 5. XSS-Safe Recursive DOM Tokenizer
To securely parse and syntax-color JSON strings and payloads without using hazardous `innerHTML` or string parsing injections (**CWE-79: XSS Prevention**):
*   Implemented a recursive browser-native DOM highlighter that tokenizes object datatypes (strings, keys, numbers, booleans, arrays).
*   It dynamically creates and mounts native text blocks and span elements (`document.createElement()`, `document.createTextNode()`, `textContent`) on-the-fly, locking down browser context boundaries from active script executions.

### 6. Grounded Markdown progressive Parser
*   Processes compact transcoded REST buffers in real-time and translates markdown markers progressively.
*   Safely generates nested list items, bullet headers, and formats gorgeous financial table margins to output grounded financial figures accurately.
*   Maps completed text segments to assigned citation annotations badges `[1]`, `[2]`, overlaying absolute coordinates float hover preview cards on hover, and linking reference cards securely to GCS storage PDF endpoints in the footer sources drawer.

---

## 📂 Core Workspaces Code Map

*   ⚙️ **[server.py](file:///Users/sokratis/Documents/Code/0_playground/server.py)**: Secure FastAPI BFF backend microservice. Handles CORS authorizations middlewares, secure headers injection, engines metadata dynamic mapping list discovery, API requests masking, and gRPC compact REST stream SSE transcoding generator.
*   🤖 **[agent/](file:///Users/sokratis/Documents/Code/0_playground/agent/)**: Coordinated AI Orchestration package folder.
    *   ⚙️ [agent.py](file:///Users/sokratis/Documents/Code/0_playground/agent/agent.py): Wire instructions and models.
    *   ⚙️ [tools.py](file:///Users/sokratis/Documents/Code/0_playground/agent/tools.py): Local Python tools mapping (Listing online databases, dynamic grounding routing).
    *   ⚙️ [prompts.py](file:///Users/sokratis/Documents/Code/0_playground/agent/prompts.py): System instructions persona.
    *   ⚙️ [agent.json](file:///Users/sokratis/Documents/Code/0_playground/agent/agent.json): Standard A2A card specifications.
*   🖼️ **[static/index.html](file:///Users/sokratis/Documents/Code/0_playground/static/index.html)**: Main HTML5 shell. Structures dynamic columns grid layout, header badging trackers, suggestions capsules, relative overlays, and side trace console terminals.
*   🎨 **[static/style.css](file:///Users/sokratis/Documents/Code/0_playground/static/style.css)**: Glassmorphic deep-space style stylesheet. Implements radial blur auroras, pulsing indicator rings, macOS Unix terminal boxes styling, custom scrolling handles, and sidebar uncollapse transitions.
*   🧠 **[static/app.js](file:///Users/sokratis/Documents/Code/0_playground/static/app.js)**: Front-end orchestration controller. Handles local history cache sessions separation, progressive stream DOM renderer, citation annotations overlays calculations, dynamic storage type iconography triggers, and recursive XSS-safe highlighted console JSON engines.

---

## 🔑 Authentication Infrastructure Details

```
  [Browser Client space]        |         [Secure BFF Local Sandbox]        |        [GCP Endpoint]
                                |                                           |
  +-----------------------+     |      +------------------------------+     |    +---------------------+
  |   app.js Dashboard    |     |      |          server.py           |     |    | Discovery Engine API|
  |                       |     |      |                              |     |    |                     |
  |  Submit Chat Query    | --- | ---> | POST /api/chat               |     |    | streamAssist REST   |
  |  (100% Token Safe)    |     |      |  (Direct engine routes)      |     |    |                     |
  |                       |     |      |                              |     |    |                     |
  |  Conversational Agent | --- | ---> | POST /api/agent/chat         |     |    | Gemini LLM API      |
  |  (Agentic Switches)   |     |      |  (ADK local InMemoryRunner)  |     |    |                     |
  |                       |     |      |                              |     |    |                     |
  |  Observes Masked Logs | < - | - -  | AuthorizedSession (ADC token)| --- | -> | Transcoded Streams  |
  |  & Live SSE Channels  |     |      |  * Signs GCP requests:       |     |    |  * Compact Bytes    |
  |                       |     |      |    Authorization: Bearer     |     |    |                     |
  +-----------------------+     |      +------------------------------+     |    +---------------------+
                                |                                           |
```

### 1. Application Default Credentials (ADC) Resolver
In **[server.py:L31](file:///Users/sokratis/Documents/Code/0_playground/server.py#L31)**:
```python
credentials, GCP_PROJECT_ID = google.auth.default()
session = AuthorizedSession(credentials)
```
*   The `google.auth.default()` subroutine automatically checks local setups sequentially:
    1.  `GOOGLE_APPLICATION_CREDENTIALS` environment variable (service account key location).
    2.  User identity authentication profile authorized locally via CLI command: `gcloud auth application-default login`.
    3.  Metadata service attached to cloud compute environments (Cloud Run service accounts).
*   The `AuthorizedSession` transport wraps HTTP request pooling under the hood, managing OAuth 2.0 access tokens lifespans and **signing requests with active GCP Bearer Tokens** securely on the server side:
    `Authorization: Bearer <access_token>`

### 2. Google GenAI SDK Vertex AI Backend Routing
To authorize the local ADK `InMemoryRunner` model bindings without requiring manual private API keys:
We globally map standard environment variables on backend startups, forcing the new GenAI SDK transport layers to route calls securely under your GCP authenticated profile access scopes:
```python
os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "1"
os.environ["GOOGLE_CLOUD_PROJECT"] = GCP_PROJECT_ID
os.environ["GOOGLE_CLOUD_LOCATION"] = "us-central1"
```

### 3. Multi-User Enterprise Authorization Map (Production Path)
To scale this sandbox dashboard to an online multi-tenant enterprise portal, OAuth 2.0 delegation maps user access directly:
1.  **OpenID Connect Identity (SSO)**: Authenticates users via your GSuite identity client. BFF stores identity details in a secure `HttpOnly; Secure; SameSite=Strict` cookie, preventing client-side reading.
2.  **Delegation Authorization Flow**: BFF executes a Google OAuth Authorization Code flow when users connect, requesting cloud access scopes.
3.  **User Scopes Access Resolution**: Instead of utilizing high-privilege server service accounts, user actions map to the user's personal delegates token. Google's API then evaluates Discovery Engine permissions strictly based on the **user's active GSuite access rights**, ensuring standard resource separation.

---

## 🏁 Quick Start Guide

### 1. Authenticate GCP Environment
Ensure you have active credential access mapped inside your terminal:
```bash
gcloud auth login
gcloud auth application-default login
gcloud config set project sokratis-genai-bb
```

### 2. Start BFF Backend Server
Ensure Python packages are installed, and launch server:
```bash
pip install fastapi uvicorn google-auth google-cloud-discoveryengine google-genai google-adk requests
python3 server.py
```

### 3. Open Exploration Spaces
1.  Launch your browser and load: **[http://127.0.0.1:8080](http://127.0.0.1:8080)**.
2.  Toggle the sidebar selector between **🧭 Direct Search** and **🤖 AI Coordinator** tabs!
3.  Type comparative prompts (e.g. asking the Coordinator to compare Alphabet revenues), and watch tools trigger dynamically in your console!
