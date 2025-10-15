import { Injector, common, components, webpack } from "replugged";
import { contextMenu, modal } from "replugged/common";
import { ContextMenuTypes, Plugin, Mount } from "replugged/types";
import { MouseEventHandler, ReactElement, memo } from "react";

const { React } = common;
const {
  ContextMenu: { MenuItem },
  Modal,
  TextInput,
  Button,
} = components;

// Store for our local edits. Key: message ID, Value: new content.
const edits = new Map<string, string>();
const injector = new Injector();

// The Modal component for editing message text
function EditModal({
  message,
  ...props
}: {
  message: { id: string; content: string };
  [key: string]: any;
}): ReactElement {
  // State to hold the new content being typed
  const [newContent, setNewContent] = React.useState(message.content);

  // Function to handle saving the edit
  const handleSave = (): void => {
    // Update the edits map
    edits.set(message.id, newContent);

    // Force an update on the message element to show the change immediately
    // This is a bit of a hack, but it's the most reliable way to get an instant visual update.
    const messageElement = document.getElementById(`chat-messages-${message.id}`);
    if (messageElement) {
      const instance = (messageElement as any)._reactInternals$?.return?.stateNode;
      if (instance) {
        instance.forceUpdate();
      }
    }

    // Close the modal
    props.onClose();
  };

  return (
    <Modal.ModalRoot {...props}>
      <Modal.ModalHeader>
        <h2 className="header-1-f9X5c-">Edit Message Locally</h2>
      </Modal.ModalHeader>
      <Modal.ModalContent>
        <TextInput
          value={newContent}
          onChange={(val) => setNewContent(val)}
          placeholder="Enter new message content..."
          autoFocus={true}
        />
      </Modal.ModalContent>
      <Modal.ModalFooter>
        <Button onClick={handleSave} color={Button.Colors.BRAND}>
          Save
        </Button>
        <Button onClick={props.onClose} color={Button.Colors.PRIMARY} look={Button.Looks.LINK}>
          Cancel
        </Button>
      </Modal.ModalFooter>
    </Modal.ModalRoot>
  );
}

// Main plugin class
export default class LocalMessageEditor extends Plugin {
  async start(): Promise<void> {
    // Patch the message context menu to add our "Edit Locally" option
    injector.after(
      contextMenu,
      "open",
      (
        [event, menu],
        res: ReactElement & {
          props: {
            children: ReactElement[];
            onClose: () => void;
          };
        },
      ) => {
        const { target } = event;
        if (!(target instanceof HTMLElement)) return res;

        // Find the message data from the React props of the target element
        const instance = (target as any)._reactInternals$;
        const message = instance?.return?.memoizedProps?.message as {
          id: string;
          content: string;
        };

        // Check if we found a valid message
        if (!message) return res;

        // Create and add our new menu item
        const editItem = (
          <MenuItem
            id="local-edit-message"
            label="Edit Locally"
            action={() => {
              // On click, open our custom modal
              modal.openModal((props) => <EditModal {...props} message={message} />);
            }}
          />
        );

        // Add the item to the menu's children
        res.props.children.push(editItem);

        return res;
      },
    );

    // Patch the Message component to display our edited text
    const Message = await webpack.waitForModule<
      { exports: { default: (props: any) => ReactElement } } & Mount
    >(webpack.filters.bySource("childrenRepliedMessage"), { raw: true });

    if (Message?.exports?.default) {
      injector.before(Message.exports, "default", ([props]) => {
        // Before the message renders, check if we have a local edit for it
        if (props.message && edits.has(props.message.id)) {
          // If we do, create a shallow copy of the message object and replace its content
          // We do this to avoid mutating the original props directly
          const newContent = edits.get(props.message.id);
          props.message = { ...props.message, content: newContent };
        }
      });
    }
  }

  // Clean up when the plugin is stopped
  stop(): void {
    injector.unpatchAll();
    edits.clear();
  }
}
