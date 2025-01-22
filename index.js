const express = require("express");
const http = require("http");
const socketIO = require("socket.io");

const app = express();
const port = process.env.PORT || 8080;

// Serve static files from the "public" directory
app.use(express.static("public"));

// Create an HTTP server
const server = http.createServer(app);

// Set up Socket.IO
const IO = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

console.log(`Server running on http://localhost:${port}`);

// Middleware for socket authentication
IO.use((socket, next) => {
  try {
    const callerId = socket.handshake.query?.callerId;
    if (!callerId) {
      console.warn("Connection attempt without callerId");
      return next(new Error("Unauthorized: Missing callerId"));
    }
    socket.user = callerId;
    console.log(`User authenticated: ${callerId}`);
    next();
  } catch (err) {
    console.error("Authentication error:", err);
    next(err);
  }
});

IO.on("connection", (socket) => {
  console.log(`User ${socket.user} connected`);
  socket.join(socket.user);

  // Handle call initiation
  socket.on("makeCall", (data) => {
    try {
      const { calleeId, sdpOffer } = data;
      if (!calleeId || !sdpOffer) {
        console.warn(`Invalid makeCall payload from ${socket.user}`, data);
        return;
      }

      console.log(`User ${socket.user} is calling ${calleeId}`);
      socket.to(calleeId).emit("newCall", {
        callerId: socket.user,
        sdpOffer,
      });
    } catch (err) {
      console.error("Error in makeCall:", err);
    }
  });

  // Handle call rejection
  socket.on("rejectCall", (data) => {
    try {
      const { callerId, reason } = data;
      if (!callerId) {
        console.warn(`Invalid rejectCall payload from ${socket.user}`, data);
        return;
      }

      console.log(`User ${socket.user} rejected call from ${callerId}`);
      socket.to(callerId).emit("callRejected", {
        callee: socket.user,
        reason: reason || "Call rejected by the callee.",
      });
    } catch (err) {
      console.error("Error in rejectCall:", err);
    }
  });

  // Handle user being busy
  socket.on("userBusy", (data) => {
    try {
      const { callerId } = data;
      if (!callerId) {
        console.warn(`Invalid userBusy payload from ${socket.user}`, data);
        return;
      }

      console.log(`User ${socket.user} is busy for ${callerId}`);
      socket.to(callerId).emit("userBusy", {
        callee: socket.user,
        message: "The callee is currently busy.",
      });
    } catch (err) {
      console.error("Error in userBusy:", err);
    }
  });

  // Handle missed call
  socket.on("missedCall", (data) => {
    try {
      const { calleeId } = data;
      if (!calleeId) {
        console.warn(`Invalid missedCall payload from ${socket.user}`, data);
        return;
      }

      console.log(`Call from ${socket.user} to ${calleeId} missed.`);
      socket.to(calleeId).emit("missedCall", {
        callerId: socket.user,
        message: "You have a missed call.",
      });
    } catch (err) {
      console.error("Error in missedCall:", err);
    }
  });

  // Handle answering the call
  socket.on("answerCall", (data) => {
    try {
      const { callerId, sdpAnswer } = data;
      if (!callerId || !sdpAnswer) {
        console.warn(`Invalid answerCall payload from ${socket.user}`, data);
        return;
      }

      console.log(`User ${socket.user} answered call from ${callerId}`);
      socket.to(callerId).emit("callAnswered", {
        callee: socket.user,
        sdpAnswer,
      });
    } catch (err) {
      console.error("Error in answerCall:", err);
    }
  });

  // Handle ICE candidates
  socket.on("IceCandidate", (data) => {
    try {
      const { calleeId, iceCandidate } = data;
      if (!calleeId || !iceCandidate) {
        console.warn(`Invalid IceCandidate payload from ${socket.user}`, data);
        return;
      }

      console.log(`User ${socket.user} sent ICE candidate to ${calleeId}`);
      socket.to(calleeId).emit("IceCandidate", {
        sender: socket.user,
        iceCandidate,
      });
    } catch (err) {
      console.error("Error in IceCandidate:", err);
    }
  });

  // Handle disconnection
  socket.on("disconnect", (reason) => {
    console.log(`User ${socket.user} disconnected. Reason: ${reason}`);
  });

  // Handle errors
  socket.on("error", (err) => {
    console.error(`Socket error for user ${socket.user}:`, err);
  });
});
