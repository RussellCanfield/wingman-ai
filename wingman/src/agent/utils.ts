import os from "node:os";

export const getMachineDetails = () => {
	const userInfo = os.userInfo();
	const machineInfo = `# User's Machine Information
Operating System: ${os.platform()}
Architecture: ${os.arch()}
Default Shell: ${userInfo.shell}`;

	return machineInfo;
};
