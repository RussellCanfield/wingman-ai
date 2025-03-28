# Canvas

[Wingman](https://marketplace.visualstudio.com/items?itemName=WingMan.wing-man) will allow you to generate images from scratch or off existing images. If your AI provider supports image generation, you will see the **canvas edit** icon under the chat input.

![](/Canvas-Tool.png)

:::note
Once GPT-4o dev tooling is released, this will be supported. For now Google AI Studio with Gemini is currently supported
:::

# Basics

The **canvas** has several tools available and should be familiar to most simple paint programs.

Here's a comprehensive explanation of the canvas basics:

## Canvas Tools Overview

1. **Drawing Tools**
   - Pencil/Brush: Create freehand sketches and drawings
   - Shapes: Add geometric shapes like rectangles and circles
   - Text: Insert text elements

2. **Selection Tools**
   - Select: Choose and manipulate individual objects
   - Move: Reposition elements on the canvas
   - Resize: Change object dimensions proportionally

3. **Color and Style**
   - Color Picker: Select fill and stroke colors
   - Stroke Width: Modify line thickness

4. **Image Management**
   - Upload: Import images from your device
   - Transform: Scale images

These tools provide a flexible environment for creative image editing and creation, suitable for various design and visualization needs.

# Importing Images

Use the `Insert` button, located at the top right to import an existing image onto the canvas.

# Generating Images

By default, if you have no objects selected in the canvas, Wingman will use the current `viewport` - in other words what is visible on the canvas to use as a basis for the image generation, if there are objects present on the canvas.

You can select objects using the selection tool as well, this will only send those selected objects up for image generation.

## Instructions

When generating images you can provide a set of instructions to guide the AI model to produce the results you want. Be as specific as you want based on how you are using the model.