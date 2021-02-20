import React, { useState, useEffect } from "react";
import Cookies from "js-cookie";
import ActivityItem from "./../ActivityItem";
import MuiAlert from "@material-ui/lab/Alert";
import { Snackbar } from "@material-ui/core";
import ConfigureWebhook from "../ConfigureWebhook";
import { githubPrivateRepoAccessClientID } from "../../utils/constants";
import { IoSettingsOutline } from "react-icons/io5";

import "./index.css";

function Alert(props) {
  return <MuiAlert elevation={6} variant="filled" {...props} />;
}

export default function ActivityPane(props) {
  const [webhookId, setWebhookId] = useState(null);
  const [webhookSubscriptions, setWebhookSubscriptions] = useState([]);
  const [events, setEvents] = useState([]);
  const [openWebhookDialog, setOpenWebhookDialog] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarSeverity, setSnackbarSeverity] = useState("success");
  const [snackbarText, setSnackbarText] = useState("");

  useEffect(() => {
    fetch(`/api/webhooks?room_name=${props.location.pathname.split("/")[2]}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Cookies.get("rc4git_token")}`,
      },
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.data.webhook) {
          setWebhookId(data.data.webhook.hook_id);
          /* On setting state directly as array setWebhookSubscriptions reducer
         sets state repeatedly due to its inability to compare previous and 
        new values of webhookSubscriptions array leading to useEffect being called 
        indefinitely. We therefore check for previous equality of webhookSubscriptions ourselves. */

          // "if" executes if length doesn't match OR arrays are not equal.
          if (
            webhookSubscriptions.length !== data.data.webhook.subscriptions.length ||
            data.data.webhook.subscriptions.forEach((i, subscription) => {
              if (webhookSubscriptions[i] !== subscription) {
                return false;
              }
            })
          )
            setWebhookSubscriptions(data.data.webhook.subscriptions);
          const events = data.data.webhook.events;
          events.sort((a, b) => {
            if (a.updated_at < b.updated_at) {
              return 1;
            }
            if (a.updated_at > b.updated_at) {
              return -1;
            }
            return 0;
          });
          setEvents(events);
        } else {
          setWebhookId(null);
        }
      })
      .catch((error) => console.log(error));
  }, [props.location.pathname]);
  useEffect(() => {
    if (webhookId) {
      let activityConnection = new EventSource(
        `/api/activities/github?hook_id=${webhookId}`,
        { withCredentials: true }
      );
      activityConnection.onmessage = (event) => {
        const data = JSON.parse(event.data);
        setEvents((events) => [data, ...events]);
      };
      return () => {
        activityConnection.close();
      };
    }
  }, [webhookId]);

  const handleClickConfigureWebhooks = async () => {
    if (!Cookies.get("gh_private_repo_token")) {
      Cookies.set("gh_upgrade_prev_path", window.location.pathname)
      document.getElementById("webhook-scope-link").click();
    } else {
      setOpenWebhookDialog(true);
    }
  };

  const setSnackbar = (snackbarSeverity, snackbarText) => {
    setSnackbarSeverity(snackbarSeverity);
    setSnackbarText(snackbarText);
    setSnackbarOpen(true);
  };

  const handleSnackbarClose = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }

    setSnackbarOpen(false);
  };

  return (
    <div className="activity-pane-wrapper">
      <div className="activity-pane-header">
        <span>Activity </span>
        <div className="configure-webhooks-control">
          <IoSettingsOutline
            className="configure-webhooks-icon"
            onClick={handleClickConfigureWebhooks}
          />
        </div>
      </div>
      <hr className="activity-pane-divider"></hr>
      <div className="activity-pane-body">
        {webhookId &&
          events.map((event) => {
            return (
              <ActivityItem
                key={event._id}
                event={event}
                repo={props.location.pathname.split("/")[2].replace("_", "/")}
              />
            );
          })}
      </div>
      <a
        id="webhook-scope-link"
        href={`https://github.com/login/oauth/authorize?scope=repo&client_id=${githubPrivateRepoAccessClientID}`}
      />
      {openWebhookDialog && (
        <ConfigureWebhook
          setSnackbar={setSnackbar}
          setOpenWebhookDialog={setOpenWebhookDialog}
          webhookId={webhookId}
          webhookSubscriptions={webhookSubscriptions}
          setWebhookSubscriptions={setWebhookSubscriptions}
          setWebhookId={setWebhookId}
          setEvents={setEvents}
          {...props}
        />
      )}

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbarSeverity}>
          {snackbarText}
        </Alert>
      </Snackbar>
    </div>
  );
}
