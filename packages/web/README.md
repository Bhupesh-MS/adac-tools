# @mindfiredigital/adac-web

The ADAC Visual Architecture Editor. This is a React-based web application for designing and visualizing architectures using ADAC.

## Features

- **Drag & Drop Interface**: Add applications and infrastructure services to your canvas.
- **Real-Time Visualization**: Powered by `@xyflow/react` and `@mindfiredigital/adac-layout-elk`.
- **YAML Export/Import**: Seamlessly transition between visual design and code.
- **AWS Icon Library**: Full support for themed AWS service icons.

## Getting Started

### Prerequisites

Ensure you have run the following in the root directory:

```bash
pnpm install
pnpm run build
```

### Diagram Generation

The application supports two diagram generation modes. By default, diagrams are generated **directly in the browser**. To use the backend instead, set the `VITE_USE_BACKEND` environment variable.

#### Browser Mode (Default)

Leave `VITE_USE_BACKEND` unset or remove it from your `.env` file.

```env
# VITE_USE_BACKEND is not set
```

Run the following command once before starting the application to copy the required icon assets:

```bash
pnpm run setup:icons
```

#### Backend Mode

To generate diagrams using the backend API, set:

```env
VITE_USE_BACKEND=true
```

### Run in Development

```bash
pnpm dev
```

### Building for Production

```bash
pnpm run build
```
