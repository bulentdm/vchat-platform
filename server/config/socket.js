// Rotalardan socket.io'ya erişmek için merkezi referans
let _io = null;

module.exports = {
  setIO: (io) => { _io = io; },
  getIO: () => _io,
};
