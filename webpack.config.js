var ngAnnotatePlugin = require('ng-annotate-webpack-plugin');

module.exports = {
	entry: './src/roo.js',
	output: {
		filename: 'ng-roo.js',
		path: __dirname + '/dist/'
	},
	plugins: [
        new ngAnnotatePlugin({
            add: true
        })
    ]
};
