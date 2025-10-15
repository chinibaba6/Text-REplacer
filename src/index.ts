import { patcher } from "@vendetta";
import { findByProps, findByDisplayName } from "@vendetta/metro";
import { React } from "@vendetta/ui";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { showInputAlert } from "@vendetta/ui/alerts";

// --- Module Imports ---
// Find the component for the long-press menu
const MessageLongPressActionSheet = findByDisplayName("MessageLongPressActionSheet", false);
// Find the component that renders the message content itself
const MessageContent = findByDisplayName("MessageContent", false);
// Find a utility to get the currently selected message
const MessageStore = findByProps("getMessage", "getMessages");

// This map will store our edits. The Key is the message ID, the Value is the new text.
const messageEdits = new Map<string, string>();

// This array will hold our cleanup functions (the 'unpatch' functions)
const unpatches: (() => void)[] = [];

export default {
    onLoad: () => {
        // --- PATCH 1: ADDING THE "EDIT LOCALLY" BUTTON ---
        unpatches.push(patcher.after("default", MessageLongPressActionSheet, (_, res: React.ReactElement) => {
            // 'res' is the rendered Action Sheet component. We need to access its props.
            const buttons = res.props.children.props.children;
            const message = MessageStore.getMessage(res.props.messageId);

            // Don't add the button if there is no message or message content
            if (!message?.content) return;

            // Add our custom button to the top of the menu
            buttons.unshift(
                React.createElement(res.props.children.props.children[0].type, {
                    label: "Edit Locally",
                    icon: getAssetIDByName("ic_edit_24px"),
                    onPress: () => {
                        showInputAlert({
                            title: "Edit Message (Local)",
                            initialValue: messageEdits.get(message.id) ?? message.content,
                            placeholder: "Enter new message content...",
                            onConfirm: (newText: string) => {
                                // When user confirms, save the new text to our map
                                if (newText.length > 0) {
                                    messageEdits.set(message.id, newText);
                                } else {
                                    // If they clear the text, remove the edit
                                    messageEdits.delete(message.id);
                                }
                            },
                            confirmText: "Save",
                            cancelText: "Cancel",
                        });
                    }
                })
            );
        }));
        
        // --- PATCH 2: DISPLAYING THE EDITED MESSAGE CONTENT ---
        unpatches.push(patcher.before("default", MessageContent, (args) => {
            const message = args[0]?.message;
            if (message && messageEdits.has(message.id)) {
                // If we have an edit for this message ID, replace its content
                // before it gets rendered.
                message.content = messageEdits.get(message.id)!;
            }
        }));
    },

    onUnload: () => {
        // This cleans up all our patches when the plugin is disabled
        for (const unpatch of unpatches) {
            unpatch();
        }
    }
};
