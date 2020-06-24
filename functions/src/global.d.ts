declare module '*.json' {
    const value: any;
    export default value;
}

interface IContext {
    auth: {
        uid: string;
        token: {
            name: string;
            picture: string;
            email: string;
        };
    };
}
