# /// script
# requires-python = ">=3.13"
# dependencies = [
#     "agno",
#     "openai",
# ]
# ///
#
# Example of how to run the script:
#
# 1. First, set the OpenRouter API key environment variable:
#    ```
#    export OPENROUTER_API_KEY=your-api-key
#    ```
#
# 2. Then run the script using uv:
#    ```
#    uv run i18n.py --dir src/renderer/src/i18n/locales "settings.mcp.autoDescription='auto set i18n', settings.mcp.autoName='auto set i18n name'"
#    ```


import json
import argparse
from pathlib import Path

from agno.agent import Agent
from agno.models.openrouter import OpenRouter
from agno.tools import tool

LANGUAGES = ["en-us", "zh-cn", "ja-jp", "ru-ru", "zh-tw"]


def ensure_json_files_exist(output_dir=None):
    """Ensure that all language JSON files exist with at least an empty object."""
    output_dir = Path(output_dir) if output_dir else Path(".")

    # Create the directory if it doesn't exist
    output_dir.mkdir(parents=True, exist_ok=True)

    for lang in LANGUAGES:
        file_path = output_dir / f"{lang}.json"
        if not file_path.exists():
            with open(file_path, "w") as f:
                json.dump({}, f, indent=4)


def set_nested_value(data, keys, value):
    """Recursively navigate through a nested dictionary and set the value."""
    if len(keys) == 1:
        data[keys[0]] = value
        return

    key = keys[0]
    if key not in data:
        data[key] = {}

    set_nested_value(data[key], keys[1:], value)


@tool(show_result=True, stop_after_tool_call=True)
def set_i18n(key: str, translations: dict[str, str], output_dir=None):
    """
    Set i18n translations for a key in all language files.

    Args:
        key: The i18n key (e.g., "settings.mcp.sync.title")
        translations: Dictionary with translations for different languages
        output_dir: Directory to store the i18n JSON files

    Example:
        set_i18n("settings.mcp.hello", {
            "en-us": "Hello",
            "zh-cn": "你好",
            "ja-jp": "こんにちは",
            "ru-ru": "Привет",
            "zh-tw": "你好"
        })
    """
    ensure_json_files_exist(output_dir)
    output_dir = Path(output_dir) if output_dir else Path(".")

    results = {}
    keys = key.split(".")
    if keys[0] != "translation":
        keys = ["translation"] + keys

    for lang, text in translations.items():
        if lang not in LANGUAGES:
            continue

        file_path = output_dir / f"{lang}.json"
        try:
            # Load existing data
            with open(file_path, "r", encoding="utf-8") as f:
                try:
                    data = json.load(f)
                except json.JSONDecodeError:
                    data = {}

            # Set the value at the nested path
            set_nested_value(data, keys, text)

            # Save the updated data
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)

            results[lang] = f"Updated {key} in {file_path}"
        except Exception as e:
            results[lang] = f"Error updating {file_path}: {str(e)}"

    return results


def main():
    """Main function to run the i18n translation agent."""
    # Set up command line argument parser
    parser = argparse.ArgumentParser(description="Translate i18n JSON content")
    parser.add_argument("content", help="JSON content to translate")
    parser.add_argument(
        "-m",
        "--model",
        default="gpt-4.1-mini",
        help="Model to use for translation (default: gpt-4.1-mini)",
    )
    parser.add_argument(
        "--dir",
        default=None,
        help="Directory to store i18n JSON files (default: current directory)",
    )

    # Parse arguments
    args = parser.parse_args()

    # Initialize the agent with the specified model
    agent = Agent(
        model=OpenRouter(id=args.model),
        tools=[set_i18n],
        markdown=True,
    )

    # Create the prompt with the provided content
    prompt = f"""Please help set i18n translations for the following content to all supported languages: {LANGUAGES}.
    <content>
    {args.content}
    </content>

    Use the provided directory {args.dir} for storing the i18n JSON files.
    """

    # Call the agent with the tools context that includes the output directory
    agent.print_response(
        prompt, stream=True, tools_context={"set_i18n": {"output_dir": args.dir}}
    )


if __name__ == "__main__":
    main()
