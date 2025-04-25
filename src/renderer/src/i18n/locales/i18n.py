# /// script
# requires-python = ">=3.13"
# dependencies = [
#     "agno",
#     "openai",
# ]
# ///

import json
from pathlib import Path

from agno.agent import Agent
from agno.models.openrouter import OpenRouter
from agno.tools import tool

LANGUAGES = ["en-us", "zh-cn", "ja-jp", "ru-ru", "zh-tw"]


def ensure_json_files_exist():
    """Ensure that all language JSON files exist with at least an empty object."""
    for lang in LANGUAGES:
        file_path = Path(f"{lang}.json")
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
def set_i18n(key: str, translations: dict[str, str]):
    """
    Set i18n translations for a key in all language files.

    Args:
        key: The i18n key (e.g., "settings.mcp.sync.title")
        translations: Dictionary with translations for different languages

    Example:
        set_i18n("settings.mcp.hello", {
            "en-us": "Hello",
            "zh-cn": "你好",
            "ja-jp": "こんにちは",
            "ru-ru": "Привет",
            "zh-tw": "你好"
        })
    """
    ensure_json_files_exist()

    results = {}
    keys = key.split(".")
    if keys[0] != "translation":
        keys = ["translation"] + keys

    for lang, text in translations.items():
        if lang not in LANGUAGES:
            continue

        file_path = f"{lang}.json"
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


content = """
{
    "settings.mcp.sync.unauthorized": "Sync Unauthorized",
    "settings.mcp.sync.noServersAvailable": "No MCP servers available"
}
"""


def main():
    """Main function to run the i18n translation agent."""
    agent = Agent(
        model=OpenRouter(id="gpt-4.1-mini"),
        tools=[set_i18n],
        markdown=True,
    )

    prompt = f"""Please help set i18n translations for the following content to all supported languages: {LANGUAGES}.
    <content>
    {content}
    </content>
    """

    agent.print_response(prompt, stream=True)


if __name__ == "__main__":
    main()
